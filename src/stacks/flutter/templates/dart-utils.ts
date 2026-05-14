export function appThemeDart(): string {
    return `import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF7F77DD)),
  );
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: const Color(0xFF7F77DD),
      brightness: Brightness.dark,
    ),
  );
}
`;
}

export function appStringsDart(): string {
    return `/// All user-facing strings in one place.
/// Keeps the codebase localisation-ready without flutter_localizations overhead.
class AppStrings {
  AppStrings._();

  // errors
  static const errorNetwork = 'No internet connection';
  static const errorGeneric = 'Something went wrong. Please try again.';
  static const errorRetry   = 'Retry';

  // common
  static const loading  = 'Loading...';
  static const cancel   = 'Cancel';
  static const confirm  = 'Confirm';
}
`;
}

export function appLoggerDart(): string {
    return `import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

class AppLogger {
  static final Logger _l = Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
    ),
    level: kDebugMode ? Level.trace : Level.off,
  );

  static void d(String m, [Object? e, StackTrace? s]) =>
      _l.d(m, error: e, stackTrace: s);
  static void i(String m, [Object? e, StackTrace? s]) =>
      _l.i(m, error: e, stackTrace: s);
  static void w(String m, [Object? e, StackTrace? s]) =>
      _l.w(m, error: e, stackTrace: s);
  static void e(String m, [Object? e, StackTrace? s]) =>
      _l.e(m, error: e, stackTrace: s);
}
`;
}

export function screenSecurityDart(appName: string, androidPackageId: string): string {
    const pkg = `package:${appName}`;
    return `import 'dart:io';
import 'package:flutter/services.dart';
import '${pkg}/core/logger/app_logger.dart';

/// Prevents screenshots on sensitive screens.
/// Android: FLAG_SECURE via platform channel.
/// iOS: use IosBackgroundBlur widget instead.
class ScreenSecurity {
  ScreenSecurity._();
  static const _ch = MethodChannel('${androidPackageId}/screen_security');

  static Future<void> enable() async {
    try {
      if (Platform.isAndroid) await _ch.invokeMethod('enableSecureScreen');
      AppLogger.d('ScreenSecurity enabled');
    } catch (e) {
      AppLogger.w('ScreenSecurity.enable failed: $e');
    }
  }

  static Future<void> disable() async {
    try {
      if (Platform.isAndroid) await _ch.invokeMethod('disableSecureScreen');
      AppLogger.d('ScreenSecurity disabled');
    } catch (e) {
      AppLogger.w('ScreenSecurity.disable failed: $e');
    }
  }
}
`;
}

export function secureScreenMixinDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'package:flutter/widgets.dart';
import '${pkg}/core/utils/screen_security.dart';

/// Add \`with SecureScreenMixin\` to any StatefulWidget State
/// to enable screenshot prevention automatically.
mixin SecureScreenMixin<T extends StatefulWidget> on State<T> {
  @override
  void initState() {
    super.initState();
    ScreenSecurity.enable();
  }

  @override
  void dispose() {
    ScreenSecurity.disable();
    super.dispose();
  }
}
`;
}

export function iosBackgroundBlurDart(): string {
    return `import 'dart:io';
import 'package:flutter/material.dart';

/// Wraps a screen with an opaque overlay when the app goes
/// to background on iOS — prevents app-switcher screenshots.
class IosBackgroundBlur extends StatefulWidget {
  final Widget child;
  const IosBackgroundBlur({super.key, required this.child});

  @override
  State<IosBackgroundBlur> createState() => _IosBackgroundBlurState();
}

class _IosBackgroundBlurState extends State<IosBackgroundBlur>
    with WidgetsBindingObserver {
  bool _obscured = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!Platform.isIOS) return;
    setState(() => _obscured =
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused);
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (_obscured)
          Positioned.fill(
            child: AbsorbPointer(
              child: Container(
                  color: Theme.of(context).scaffoldBackgroundColor),
            ),
          ),
      ],
    );
  }
}
`;
}
