export function connectivityStateDart(): string {
    return `part of 'connectivity_cubit.dart';

sealed class ConnectivityState { const ConnectivityState(); }
final class ConnectivityInitial extends ConnectivityState { const ConnectivityInitial(); }
final class ConnectivityOnline  extends ConnectivityState { const ConnectivityOnline(); }
final class ConnectivityOffline extends ConnectivityState { const ConnectivityOffline(); }
`;
}

export function connectivityCubitDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '${pkg}/core/logger/app_logger.dart';
part 'connectivity_state.dart';

class ConnectivityCubit extends Cubit<ConnectivityState> {
  final Connectivity _connectivity;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  ConnectivityCubit(this._connectivity)
      : super(const ConnectivityInitial()) {
    _init();
  }

  Future<void> _init() async {
    try {
      _onChanged(await _connectivity.checkConnectivity());
      _sub = _connectivity.onConnectivityChanged.listen(_onChanged);
    } catch (e, s) {
      AppLogger.e('ConnectivityCubit._init failed', e, s);
      emit(const ConnectivityOffline());
    }
  }

  void _onChanged(List<ConnectivityResult> results) {
    final online = results.any((r) => r != ConnectivityResult.none);
    AppLogger.d('Network: \${online ? 'online' : 'offline'}');
    emit(online ? const ConnectivityOnline() : const ConnectivityOffline());
  }

  bool get isOnline => state is ConnectivityOnline;

  @override
  Future<void> close() {
    _sub?.cancel();
    return super.close();
  }
}
`;
}
