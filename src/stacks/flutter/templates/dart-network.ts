import type { FlutterContext } from '../prompts.js';
import { toCamel } from '../helpers.js';

export function dioFactoryDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import '${pkg}/core/connectivity/connectivity_cubit.dart';
import '${pkg}/core/logger/app_logger.dart';
import '${pkg}/core/network/app_interceptors.dart';

/// Creates configured Dio instances per service.
/// Each service gets its own base URL, headers, and interceptors.
class DioFactory {
  final ConnectivityCubit _connectivity;

  DioFactory(this._connectivity);

  Dio create({
    required String baseUrl,
    Map<String, String> extraHeaders = const {},
    Duration connectTimeout = const Duration(seconds: 10),
    Duration receiveTimeout = const Duration(seconds: 15),
    Duration sendTimeout = const Duration(seconds: 10),
  }) {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: connectTimeout,
      receiveTimeout: receiveTimeout,
      sendTimeout: sendTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...extraHeaders,
      },
    ));
    dio.interceptors.addAll([
      AppInterceptors(dio, _connectivity),
      if (kDebugMode)
        PrettyDioLogger(
          requestHeader: true,
          requestBody: true,
          responseBody: true,
          error: true,
        ),
    ]);
    AppLogger.i('Dio created for $baseUrl');
    return dio;
  }
}
`;
}

export function appInterceptorsDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'dart:async';
import 'package:dio/dio.dart';
import '${pkg}/core/connectivity/connectivity_cubit.dart';
import '${pkg}/core/framework/server_error.dart';
import '${pkg}/core/logger/app_logger.dart';

class AppInterceptors extends Interceptor {
  final Dio _dio;
  final ConnectivityCubit _connectivity;

  bool _isRefreshing = false;
  final List<void Function(String token)> _queue = [];

  AppInterceptors(this._dio, this._connectivity);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!_connectivity.isOnline) {
      handler.reject(DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: const ServerError(message: 'No Internet Connection', code: '101'),
      ));
      return;
    }
    // TODO: attach token
    // final token = sl<TokenStorage>().getAccessToken();
    // if (token != null) options.headers['Authorization'] = 'Bearer $token';
    AppLogger.d('-> \${options.method} \${options.uri}');
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    AppLogger.d('<- \${response.statusCode ?? ''} \${response.requestOptions.path}');
    handler.next(response);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      final opts = err.response!.requestOptions;
      if (opts.headers['Retry-Count'] == 1) { _expire(err, handler); return; }
      if (_isRefreshing) { await _enqueue(opts, handler); return; }
      _isRefreshing = true;
      try {
        final token = await _refresh();
        _drainQueue(token);
        _isRefreshing = false;
        opts.headers['Authorization'] = 'Bearer $token';
        opts.headers['Retry-Count'] = 1;
        handler.resolve(await _dio.fetch(opts));
      } catch (_) {
        _isRefreshing = false;
        _clearQueue();
        _expire(err, handler);
      }
      return;
    }
    handler.next(err);
  }

  /// TODO: implement real token refresh endpoint
  Future<String> _refresh() =>
      Future.error(UnimplementedError('Implement _refresh() in AppInterceptors'));

  Future<void> _enqueue(RequestOptions opts, ErrorInterceptorHandler h) async {
    final c = Completer<void>();
    _queue.add((token) async {
      opts.headers['Authorization'] = 'Bearer $token';
      try { h.resolve(await _dio.fetch(opts)); }
      catch (e) { h.next(DioException(requestOptions: opts, error: e)); }
      c.complete();
    });
    return c.future;
  }

  void _drainQueue(String token) {
    for (final fn in _queue) fn(token);
    _queue.clear();
  }
  void _clearQueue() => _queue.clear();

  void _expire(DioException err, ErrorInterceptorHandler h) {
    _isRefreshing = false;
    _clearQueue();
    AppLogger.w('Session expired — redirect to login');
    // TODO: sl<AuthCubit>().logout();
    h.next(err);
  }
}
`;
}

export function dioClientDart(ctx: FlutterContext): string {
    const pkg = `package:${ctx.appName}`;
    const lines: string[] = [
        `import 'package:dio/dio.dart';`,
        `import '${pkg}/core/network/dio_factory.dart';`,
        `import '${pkg}/core/config/app_config.dart';`,
        `import '${pkg}/core/config/service_headers.dart';`,
        '',
        '/// Pre-registered Dio instances per backend service.',
        '/// Each service has its own base URL, headers, and interceptors.',
        '/// Add new services here when scaling.',
        'class DioClient {',
        '  final DioFactory _factory;',
        '',
        '  DioClient(this._factory);',
        '',
    ];

    for (const svc of ctx.services) {
        const getter = toCamel(svc.name);
        const configProp = `${getter}BaseUrl`;
        lines.push(`  Dio? _${getter};`);
        lines.push(`  Dio get ${getter} => _${getter} ??= _factory.create(`);
        lines.push(`    baseUrl: AppConfig.${configProp},`);
        lines.push(`    extraHeaders: ServiceHeaders.${getter},`);
        lines.push(`  );`);
        lines.push('');
    }

    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

export function apiRequestServiceDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:either_dart/either.dart';
import '${pkg}/core/framework/api_request_model.dart';
import '${pkg}/core/framework/api_response_model.dart';
import '${pkg}/core/framework/server_error.dart';
import '${pkg}/core/logger/app_logger.dart';

enum HttpMethod { get, post, put, patch, delete }

/// Base class for all remote datasources.
///
/// Usage:
/// \`\`\`dart
/// class LoginDatasource extends APIRequestService {
///   LoginDatasource(super.dio);
/// }
/// \`\`\`
class APIRequestService {
  final Dio dio;

  APIRequestService(this.dio);

  Future<Either<ServerError, T>> request<T extends ApiResponseModel>({
    required String apiUrlEndPoint,
    required T Function(Map<String, dynamic>) fromJson,
    ApiRequestModel? requestModel,
    Map<String, dynamic>? queryParameters,
    Map<String, dynamic>? pathParameters,
    Map<String, String>? extraHeaders,
    String? hostUrl,
    required HttpMethod httpMethod,
  }) async {
    try {
      var url = apiUrlEndPoint;
      pathParameters?.forEach(
          (k, v) => url = url.replaceAll('{\\$k}', v.toString()));

      if (hostUrl != null) {
        url = '$hostUrl$url';
      }

      AppLogger.d('-> \${httpMethod.name.toUpperCase()} $url');
      final body = requestModel?.toJson();

      final Options? options = extraHeaders != null && extraHeaders.isNotEmpty
          ? Options(headers: extraHeaders)
          : null;

      final Response resp = switch (httpMethod) {
        HttpMethod.get =>
          await dio.get(url, queryParameters: queryParameters, options: options),
        HttpMethod.post =>
          await dio.post(url, data: body, queryParameters: queryParameters, options: options),
        HttpMethod.put =>
          await dio.put(url, data: body, queryParameters: queryParameters, options: options),
        HttpMethod.patch =>
          await dio.patch(url, data: body, queryParameters: queryParameters, options: options),
        HttpMethod.delete =>
          await dio.delete(url, queryParameters: queryParameters, options: options),
      };

      if (resp.statusCode == 200 || resp.statusCode == 201) {
        final map = resp.data is Map<String, dynamic>
            ? resp.data as Map<String, dynamic>
            : jsonDecode(resp.data.toString()) as Map<String, dynamic>;
        return Right(fromJson(map));
      }

      return Left(ServerError(
        message: resp.data.toString(),
        code: (resp.statusCode ?? 0).toString(),
      ));
    } on DioException catch (e) {
      final code = e.response?.statusCode?.toString() ?? '000';
      final msg = e.response?.data?.toString() ?? e.message ?? 'Network error';
      AppLogger.e('Dio [$code] $msg', e);
      return Left(ServerError(message: msg, code: code));
    } on SocketException {
      return const Left(ServerError(message: 'No Internet Connection', code: '101'));
    } on FormatException catch (e) {
      return Left(ServerError(message: 'Format: \${e.message}', code: '102'));
    } catch (e) {
      AppLogger.e('Unexpected error', e);
      return Left(ServerError(message: e.toString(), code: '103'));
    }
  }
}
`;
}
