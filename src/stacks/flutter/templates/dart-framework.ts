export function serverErrorDart(): string {
    return `class ServerError {
  final String message;
  final String code;
  const ServerError({required this.message, required this.code});

  bool get isUnauthorized => code == '401';
  bool get isForbidden    => code == '403';
  bool get isNotFound     => code == '404';
  bool get isNetworkError => code == '101';
  bool get isTimeout      => code == '102';
  bool get isServerError  => (int.tryParse(code) ?? 0) >= 500;

  @override
  String toString() => 'ServerError($code): $message';
}
`;
}

export function apiResponseModelDart(): string {
    return 'abstract class ApiResponseModel {}\n';
}

export function apiRequestModelDart(): string {
    return `abstract class ApiRequestModel {
  Map<String, dynamic> toJson();
}
`;
}
