// Mason template variables (Mustache syntax — treated as literal strings in output)
const FN = '{{feature_name}}';
const PC = '{{#pascalCase}}{{feature_name}}{{/pascalCase}}';
const PN = '{{package_name}}';

function brickPath(brick: string, sub: string): string {
    return `bricks/${brick}/__brick__/lib/features/${FN}/${sub}`;
}

export function brickFiles(): Record<string, string> {
    const files: Record<string, string> = {};

    // ── brick.yaml files ──────────────────────────────────────────────────
    files['bricks/clean_feature/brick.yaml'] =
        'name: clean_feature\n' +
        'description: Clean arch feature\n' +
        'version: 0.1.2\n' +
        'vars:\n' +
        '  feature_name:\n' +
        '    type: string\n' +
        '    description: snake_case feature name\n' +
        '  package_name:\n' +
        '    type: string\n' +
        '    description: pubspec name (e.g. accu_shield)\n';

    files['bricks/clean_form_feature/brick.yaml'] =
        'name: clean_form_feature\n' +
        'description: Clean arch form feature\n' +
        'version: 0.1.2\n' +
        'vars:\n' +
        '  feature_name:\n' +
        '    type: string\n' +
        '    description: snake_case feature name\n' +
        '  package_name:\n' +
        '    type: string\n' +
        '    description: pubspec name (e.g. accu_shield)\n';

    // ── Entity (both bricks) ──────────────────────────────────────────────
    const entity =
        "import 'package:equatable/equatable.dart';\n" +
        'class ' + PC + 'Entity extends Equatable {\n' +
        '  const ' + PC + 'Entity();\n' +
        '  // TODO: add fields\n' +
        '  @override List<Object?> get props => [];\n' +
        '}\n';

    files[brickPath('clean_feature', 'domain/entities/' + FN + '_entity.dart')] = entity;
    files[brickPath('clean_form_feature', 'domain/entities/' + FN + '_entity.dart')] = entity;

    // ── Model (both bricks) ──────────────────────────────────────────────
    const model =
        "import 'package:" + PN + "/core/framework/api_response_model.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n\n" +
        'class ' + PC + 'Model extends ApiResponseModel {\n' +
        '  const ' + PC + 'Model();\n' +
        '  // TODO: add fields\n' +
        '  factory ' + PC + 'Model.fromJson(Map<String, dynamic> json) => const ' + PC + 'Model();\n' +
        '  ' + PC + 'Entity toEntity() => const ' + PC + 'Entity();\n' +
        '}\n';

    files[brickPath('clean_feature', 'data/models/' + FN + '_model.dart')] = model;
    files[brickPath('clean_form_feature', 'data/models/' + FN + '_model.dart')] = model;

    // ── clean_feature — repo contract ─────────────────────────────────────
    files[brickPath('clean_feature', 'domain/repositories/' + FN + '_repository.dart')] =
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n\n" +
        'abstract class ' + PC + 'Repository {\n' +
        '  Future<Either<ServerError, ' + PC + 'Entity>> get' + PC + '();\n' +
        '}\n';

    // ── clean_feature — use case ──────────────────────────────────────────
    files[brickPath('clean_feature', 'domain/usecases/get_' + FN + '_usecase.dart')] =
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/repositories/' + FN + "_repository.dart';\n\n" +
        'class Get' + PC + 'UseCase {\n' +
        '  final ' + PC + 'Repository _repo;\n' +
        '  const Get' + PC + 'UseCase(this._repo);\n' +
        '  Future<Either<ServerError, ' + PC + 'Entity>> call() => _repo.get' + PC + '();\n' +
        '}\n';

    // ── clean_feature — remote datasource ────────────────────────────────
    files[brickPath('clean_feature', 'data/datasources/' + FN + '_remote_datasource.dart')] =
        "import 'package:dio/dio.dart';\n" +
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/config/api_endpoints.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + "/core/network/api_request_service.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/data/models/' + FN + "_model.dart';\n\n" +
        'abstract class ' + PC + 'RemoteDataSource {\n' +
        '  Future<Either<ServerError, ' + PC + 'Model>> fetch' + PC + '();\n' +
        '}\n\n' +
        'class ' + PC + 'RemoteDataSourceImpl\n' +
        '    extends APIRequestService\n' +
        '    implements ' + PC + 'RemoteDataSource {\n' +
        '  ' + PC + 'RemoteDataSourceImpl(super.dio);\n\n' +
        '  @override\n' +
        '  Future<Either<ServerError, ' + PC + 'Model>> fetch' + PC + '() =>\n' +
        '      request(\n' +
        "        apiUrlEndPoint: '/" + FN + "', // TODO: use ApiEndpoints constant\n" +
        '        fromJson: ' + PC + 'Model.fromJson,\n' +
        '        httpMethod: HttpMethod.get,\n' +
        '      );\n' +
        '}\n';

    // ── clean_feature — repo impl ─────────────────────────────────────────
    files[brickPath('clean_feature', 'data/repositories/' + FN + '_repository_impl.dart')] =
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/repositories/' + FN + "_repository.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/data/datasources/' + FN + "_remote_datasource.dart';\n\n" +
        'class ' + PC + 'RepositoryImpl implements ' + PC + 'Repository {\n' +
        '  final ' + PC + 'RemoteDataSource _remote;\n' +
        '  const ' + PC + 'RepositoryImpl(this._remote);\n\n' +
        '  @override\n' +
        '  Future<Either<ServerError, ' + PC + 'Entity>> get' + PC + '() async {\n' +
        '    final result = await _remote.fetch' + PC + '();\n' +
        '    return result.map((m) => m.toEntity());\n' +
        '  }\n' +
        '}\n';

    // ── clean_feature — cubit state ───────────────────────────────────────
    files[brickPath('clean_feature', 'presentation/cubit/' + FN + '_state.dart')] =
        "part of '" + FN + "_cubit.dart';\n\n" +
        'sealed class ' + PC + 'State { const ' + PC + 'State(); }\n\n' +
        'final class ' + PC + 'Initial extends ' + PC + 'State { const ' + PC + 'Initial(); }\n' +
        'final class ' + PC + 'Loading extends ' + PC + 'State { const ' + PC + 'Loading(); }\n' +
        'final class ' + PC + 'Loaded  extends ' + PC + 'State {\n' +
        '  final dynamic data;\n' +
        '  const ' + PC + 'Loaded(this.data);\n' +
        '}\n' +
        'final class ' + PC + 'Error extends ' + PC + 'State {\n' +
        '  final String message;\n' +
        '  const ' + PC + 'Error(this.message);\n' +
        '}\n';

    // ── clean_feature — cubit ─────────────────────────────────────────────
    files[brickPath('clean_feature', 'presentation/cubit/' + FN + '_cubit.dart')] =
        "import 'package:flutter_bloc/flutter_bloc.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/usecases/get_' + FN + "_usecase.dart';\n" +
        "part '" + FN + "_state.dart';\n\n" +
        'class ' + PC + 'Cubit extends Cubit<' + PC + 'State> {\n' +
        '  final Get' + PC + 'UseCase _useCase;\n\n' +
        '  ' + PC + 'Cubit(this._useCase) : super(const ' + PC + 'Initial());\n\n' +
        '  Future<void> fetch() async {\n' +
        '    if (state is ' + PC + 'Loading) return;\n' +
        '    emit(const ' + PC + 'Loading());\n' +
        '    (await _useCase()).fold(\n' +
        '      (err)  => emit(' + PC + 'Error(err.message)),\n' +
        '      (data) => emit(' + PC + 'Loaded(data)),\n' +
        '    );\n' +
        '  }\n' +
        '}\n';

    // ── clean_feature — page ──────────────────────────────────────────────
    files[brickPath('clean_feature', 'presentation/pages/' + FN + '_page.dart')] =
        "import 'package:flutter/material.dart';\n" +
        "import 'package:flutter_bloc/flutter_bloc.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/presentation/cubit/' + FN + "_cubit.dart';\n\n" +
        'class ' + PC + 'Page extends StatelessWidget {\n' +
        "  const " + PC + "Page({super.key});\n\n" +
        '  @override\n' +
        '  Widget build(BuildContext context) {\n' +
        '    return Scaffold(\n' +
        "      appBar: AppBar(title: const Text('" + PC + "')),\n" +
        '      body: BlocConsumer<' + PC + 'Cubit, ' + PC + 'State>(\n' +
        '        listener: (ctx, state) {\n' +
        '          if (state is ' + PC + 'Error) {\n' +
        '            ScaffoldMessenger.of(ctx).showSnackBar(\n' +
        '              SnackBar(content: Text(state.message), backgroundColor: Colors.red),\n' +
        '            );\n' +
        '          }\n' +
        '        },\n' +
        '        builder: (ctx, state) => switch (state) {\n' +
        '          ' + PC + 'Initial()             => const SizedBox.shrink(),\n' +
        '          ' + PC + 'Loading()             => const Center(child: CircularProgressIndicator()),\n' +
        '          ' + PC + 'Loaded(:final data)   => Center(child: Text(data.toString())),\n' +
        '          ' + PC + 'Error(:final message) => Center(\n' +
        '            child: Column(\n' +
        '              mainAxisSize: MainAxisSize.min,\n' +
        '              children: [\n' +
        '                Text(message, style: const TextStyle(color: Colors.red)),\n' +
        '                const SizedBox(height: 12),\n' +
        '                ElevatedButton(\n' +
        "                  onPressed: () => context.read<" + PC + 'Cubit>().fetch(),\n' +
        "                  child: const Text('Retry'),\n" +
        '                ),\n' +
        '              ],\n' +
        '            ),\n' +
        '          ),\n' +
        '        },\n' +
        '      ),\n' +
        '    );\n' +
        '  }\n' +
        '}\n';

    // ── clean_form_feature extras ─────────────────────────────────────────
    files[brickPath('clean_form_feature', 'domain/repositories/' + FN + '_repository.dart')] =
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n\n" +
        'abstract class ' + PC + 'Repository {\n' +
        '  Future<Either<ServerError, ' + PC + 'Entity>> submit' + PC + '(Map<String, dynamic> data);\n' +
        '}\n';

    files[brickPath('clean_form_feature', 'domain/usecases/submit_' + FN + '_usecase.dart')] =
        "import 'package:either_dart/either.dart';\n" +
        "import 'package:" + PN + "/core/framework/server_error.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/entities/' + FN + "_entity.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/repositories/' + FN + "_repository.dart';\n\n" +
        'class Submit' + PC + 'UseCase {\n' +
        '  final ' + PC + 'Repository _repo;\n' +
        '  const Submit' + PC + 'UseCase(this._repo);\n' +
        '  Future<Either<ServerError, ' + PC + 'Entity>> call(Map<String, dynamic> d) =>\n' +
        '      _repo.submit' + PC + '(d);\n' +
        '}\n';

    files[brickPath('clean_form_feature', 'presentation/cubit/' + FN + '_state.dart')] =
        "part of '" + FN + "_cubit.dart';\n\n" +
        'sealed class ' + PC + 'State { const ' + PC + 'State(); }\n\n' +
        'final class ' + PC + 'Initial    extends ' + PC + 'State { const ' + PC + 'Initial(); }\n' +
        'final class ' + PC + 'Submitting extends ' + PC + 'State { const ' + PC + 'Submitting(); }\n' +
        'final class ' + PC + 'FieldUpdated extends ' + PC + 'State {\n' +
        '  final Map<String, String>  fields;\n' +
        '  final Map<String, String?> errors;\n' +
        '  const ' + PC + 'FieldUpdated(this.fields, this.errors);\n' +
        '}\n' +
        'final class ' + PC + 'Success extends ' + PC + 'State {\n' +
        '  final dynamic data;\n' +
        '  const ' + PC + 'Success(this.data);\n' +
        '}\n' +
        'final class ' + PC + 'Error extends ' + PC + 'State {\n' +
        '  final String message;\n' +
        '  const ' + PC + 'Error(this.message);\n' +
        '}\n';

    files[brickPath('clean_form_feature', 'presentation/cubit/' + FN + '_cubit.dart')] =
        "import 'package:flutter_bloc/flutter_bloc.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/domain/usecases/submit_' + FN + "_usecase.dart';\n" +
        "part '" + FN + "_state.dart';\n\n" +
        'class ' + PC + 'Cubit extends Cubit<' + PC + 'State> {\n' +
        '  final Submit' + PC + 'UseCase _useCase;\n' +
        '  final Map<String, String>  _fields = {};\n' +
        '  final Map<String, String?> _errors = {};\n\n' +
        '  ' + PC + 'Cubit(this._useCase) : super(const ' + PC + 'Initial());\n\n' +
        '  void updateField(String key, String value) {\n' +
        '    _fields[key] = value;\n' +
        '    _errors.remove(key);\n' +
        '    emit(' + PC + 'FieldUpdated(Map.of(_fields), Map.of(_errors)));\n' +
        '  }\n\n' +
        '  bool _validate() {\n' +
        '    _errors.clear();\n' +
        '    for (final e in _fields.entries) {\n' +
        "      if (e.value.trim().isEmpty) _errors[e.key] = '${e.key} is required';\n" +
        '    }\n' +
        '    return _errors.isEmpty;\n' +
        '  }\n\n' +
        '  Future<void> submit() async {\n' +
        '    if (!_validate()) {\n' +
        '      emit(' + PC + 'FieldUpdated(Map.of(_fields), Map.of(_errors)));\n' +
        '      return;\n' +
        '    }\n' +
        '    emit(const ' + PC + 'Submitting());\n' +
        '    (await _useCase(Map.of(_fields))).fold(\n' +
        '      (err)  => emit(' + PC + 'Error(err.message)),\n' +
        '      (data) => emit(' + PC + 'Success(data)),\n' +
        '    );\n' +
        '  }\n' +
        '}\n';

    files[brickPath('clean_form_feature', 'presentation/pages/' + FN + '_page.dart')] =
        "import 'package:flutter/material.dart';\n" +
        "import 'package:flutter_bloc/flutter_bloc.dart';\n" +
        "import 'package:" + PN + '/features/' + FN + '/presentation/cubit/' + FN + "_cubit.dart';\n\n" +
        'class ' + PC + 'Page extends StatelessWidget {\n' +
        "  const " + PC + "Page({super.key});\n\n" +
        '  @override\n' +
        '  Widget build(BuildContext context) {\n' +
        '    final cubit = context.read<' + PC + 'Cubit>();\n' +
        '    return Scaffold(\n' +
        "      appBar: AppBar(title: const Text('" + PC + "')),\n" +
        '      body: BlocConsumer<' + PC + 'Cubit, ' + PC + 'State>(\n' +
        '        listener: (ctx, state) {\n' +
        '          if (state is ' + PC + 'Error) {\n' +
        '            ScaffoldMessenger.of(ctx).showSnackBar(\n' +
        '              SnackBar(content: Text(state.message), backgroundColor: Colors.red),\n' +
        '            );\n' +
        '          }\n' +
        '        },\n' +
        '        builder: (ctx, state) {\n' +
        '          if (state is ' + PC + 'Submitting) {\n' +
        '            return const Center(child: CircularProgressIndicator());\n' +
        '          }\n' +
        '          return Padding(\n' +
        '            padding: const EdgeInsets.all(16),\n' +
        '            child: Column(\n' +
        '              children: [\n' +
        '                // TODO: add TextFields calling cubit.updateField(key, value)\n' +
        '                const SizedBox(height: 24),\n' +
        '                SizedBox(\n' +
        '                  width: double.infinity,\n' +
        '                  child: ElevatedButton(\n' +
        '                    onPressed: cubit.submit,\n' +
        "                    child: const Text('Submit'),\n" +
        '                  ),\n' +
        '                ),\n' +
        '              ],\n' +
        '            ),\n' +
        '          );\n' +
        '        },\n' +
        '      ),\n' +
        '    );\n' +
        '  }\n' +
        '}\n';

    return files;
}
