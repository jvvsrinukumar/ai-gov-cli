import type { FlutterContext } from '../prompts.js';

export function injectionDart(ctx: FlutterContext): string {
    const pkg = `package:${ctx.appName}`;
    const lines: string[] = [
        `import 'package:connectivity_plus/connectivity_plus.dart';`,
        `import 'package:get_it/get_it.dart';`,
        `import '${pkg}/core/connectivity/connectivity_cubit.dart';`,
        `import '${pkg}/core/network/dio_factory.dart';`,
        `import '${pkg}/core/network/dio_client.dart';`,
        '',
        'final sl = GetIt.instance;',
        '',
        'Future<void> configureDependencies() async {',
        '  // ── core ──────────────────────────────────────────────',
        '  sl.registerLazySingleton(() => Connectivity());',
        '  sl.registerLazySingleton(() => ConnectivityCubit(sl()));',
        '  sl.registerLazySingleton(() => DioFactory(sl<ConnectivityCubit>()));',
        '  sl.registerLazySingleton(() => DioClient(sl<DioFactory>()));',
        '',
        '  // ── features ──────────────────────────────────────────',
        '  // Add feature registrations here.',
        '  // See TODO_MISSING.md #3 — split into per-feature files',
        '  // once you have more than 5 features.',
        '}',
        '',
    ];

    return lines.join('\n');
}

export function paginationStateDart(): string {
    return `part of 'pagination_cubit.dart';

sealed class PaginationState<T> { const PaginationState(); }

final class PaginationInitial<T> extends PaginationState<T> {
  const PaginationInitial();
}
final class PaginationLoading<T> extends PaginationState<T> {
  const PaginationLoading();
}
final class PaginationLoadingMore<T> extends PaginationState<T> {
  final List<T> items;
  const PaginationLoadingMore(this.items);
}
final class PaginationLoaded<T> extends PaginationState<T> {
  final List<T> items;
  final bool hasMore;
  const PaginationLoaded(this.items, {required this.hasMore});
}
final class PaginationError<T> extends PaginationState<T> {
  final List<T> items;
  final String message;
  const PaginationError(this.items, this.message);
}
`;
}

export function paginationCubitDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'package:either_dart/either.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '${pkg}/core/framework/server_error.dart';
import '${pkg}/core/logger/app_logger.dart';
part 'pagination_state.dart';

abstract class PaginationCubit<T> extends Cubit<PaginationState<T>> {
  final int pageSize;

  PaginationCubit({this.pageSize = 20}) : super(const PaginationInitial());

  int _page = 1;
  bool _hasMore = true;
  final List<T> _items = [];

  bool get hasMore => _hasMore;

  Future<Either<ServerError, List<T>>> fetchPage(int page);

  Future<void> load() async {
    _page = 1; _hasMore = true; _items.clear();
    emit(const PaginationLoading());
    await _fetch();
  }

  Future<void> loadMore() async {
    if (!_hasMore || state is PaginationLoadingMore) return;
    emit(PaginationLoadingMore(List.of(_items)));
    await _fetch();
  }

  Future<void> _fetch() async {
    (await fetchPage(_page)).fold(
      (e) {
        AppLogger.e('Page $_page: \${e.message}');
        emit(PaginationError(List.of(_items), e.message));
      },
      (items) {
        _page++;
        if (items.length < pageSize) _hasMore = false;
        _items.addAll(items);
        emit(PaginationLoaded(List.of(_items), hasMore: _hasMore));
      },
    );
  }

  void removeItem(T item) {
    _items.remove(item);
    if (state is PaginationLoaded<T>) {
      emit(PaginationLoaded(List.of(_items),
          hasMore: (state as PaginationLoaded<T>).hasMore));
    }
  }

  void updateItem(T oldItem, T newItem) {
    final i = _items.indexOf(oldItem);
    if (i == -1) return;
    _items[i] = newItem;
    if (state is PaginationLoaded<T>) {
      emit(PaginationLoaded(List.of(_items),
          hasMore: (state as PaginationLoaded<T>).hasMore));
    }
  }
}
`;
}

export function featureFlagServiceDart(): string {
    return `abstract class FeatureFlagService {
  bool isEnabled(AppFeatureFlag flag);
}

enum AppFeatureFlag {
  newDashboard,
  biometricLogin,
  darkModeToggle,
}

class LocalFeatureFlagService implements FeatureFlagService {
  const LocalFeatureFlagService();
  @override
  bool isEnabled(AppFeatureFlag flag) => true;
}
`;
}

export function analyticsServiceDart(): string {
    return `abstract class AnalyticsService {
  Future<void> logEvent(String name, {Map<String, dynamic>? params});
  Future<void> logScreenView(String screenName);
  Future<void> setUserId(String id);
}

class NoOpAnalyticsService implements AnalyticsService {
  const NoOpAnalyticsService();
  @override Future<void> logEvent(String n, {Map<String, dynamic>? params}) async {}
  @override Future<void> logScreenView(String s) async {}
  @override Future<void> setUserId(String id) async {}
}
`;
}
