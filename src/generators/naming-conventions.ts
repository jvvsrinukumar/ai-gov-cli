import type { GovernanceConfig } from '../types.js';

export function generateNamingConventions(c: GovernanceConfig): string {
    const { profile: p, blocks: b } = c;

    const layerFilePatterns = buildLayerFilePatterns(c);
    const directoryNaming = buildDirectoryNaming(c);
    const generatedNote = p.generatedPatterns
        ? `\n## Generated Files — Do Not Edit\nFiles matching \`${p.generatedPatterns}\` are auto-generated. Never edit them directly.`
        : '';

    return `# Naming Conventions — ${p.stackDisplay}

## Core Naming Rules
- **Classes:** ${p.namingClasses}
- **Methods/Functions:** ${p.namingMethods}
- **Constants:** ${p.namingConstants}
- **Files:** ${p.namingFiles}

> See also \`coding-standards.md\` for code style rules. This file is the authoritative source for naming.

## Type Naming
${b.typeNaming}

## File Naming by Layer
${layerFilePatterns}

## Directory / Feature Naming
${directoryNaming}

## Import Order
${p.importStyle || 'third-party → project internal'}
${generatedNote}`;
}

function buildLayerFilePatterns(c: GovernanceConfig): string {
    switch (c.stack) {
        case 'flutter': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Widget (UI) | \`<feature>_<suffix>.dart\` | \`user_profile_widget.dart\` |
| Cubit (State) | \`<feature>_cubit.dart\` + \`<feature>_state.dart\` | \`user_profile_cubit.dart\` |
| UseCase | \`<action>_use_case.dart\` | \`get_user_profile_use_case.dart\` |
| Repository (interface) | \`<feature>_repository.dart\` | \`user_repository.dart\` |
| Service (data) | \`<feature>_service.dart\` | \`user_service.dart\` |
| Domain Model | \`<entity>.dart\` | \`user.dart\` |
| Test | \`<source_file_name>_test.dart\` | \`user_profile_cubit_test.dart\` |`.trim();

        case 'kotlin': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Screen (Composable) | \`<Feature>Screen.kt\` | \`UserProfileScreen.kt\` |
| ViewModel | \`<Feature>ViewModel.kt\` | \`UserProfileViewModel.kt\` |
| UseCase | \`<Action>UseCase.kt\` | \`GetUserProfileUseCase.kt\` |
| Repository (interface) | \`<Feature>Repository.kt\` | \`UserRepository.kt\` |
| Repository (impl) | \`<Feature>RepositoryImpl.kt\` | \`UserRepositoryImpl.kt\` |
| DataSource | \`<Feature>RemoteDataSource.kt\` / \`<Feature>LocalDataSource.kt\` | \`UserRemoteDataSource.kt\` |
| Domain Model | \`<Entity>.kt\` | \`User.kt\` |
| Test | \`<Source>Test.kt\` | \`UserProfileViewModelTest.kt\` |`.trim();

        case 'react': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Component | \`<Name>.tsx\` (PascalCase) | \`UserProfile.tsx\` |
| Hook | \`use<Name>.ts\` (camelCase with \`use\` prefix) | \`useUserProfile.ts\` |
| Service | \`<name>Service.ts\` or \`<name>.service.ts\` | \`userProfileService.ts\` |
| API client | \`<name>Api.ts\` or \`<name>.api.ts\` | \`userProfileApi.ts\` |
| Types | \`<name>.types.ts\` or \`types.ts\` | \`userProfile.types.ts\` |
| Context | \`<Name>Context.tsx\` + \`<Name>Provider.tsx\` | \`UserContext.tsx\` |
| Test | \`<Source>.test.tsx\` / \`<Source>.spec.ts\` | \`UserProfile.test.tsx\` |`.trim();

        case 'angular': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Component | \`<feature>.component.ts\` + \`<feature>.component.html\` | \`user-profile.component.ts\` |
| Service | \`<feature>.service.ts\` | \`user-profile.service.ts\` |
| Module (NgModule) | \`<feature>.module.ts\` | \`user-profile.module.ts\` |
| Guard | \`<name>.guard.ts\` | \`auth.guard.ts\` |
| Pipe | \`<name>.pipe.ts\` | \`date-format.pipe.ts\` |
| Directive | \`<name>.directive.ts\` | \`highlight.directive.ts\` |
| Test | \`<source>.spec.ts\` | \`user-profile.component.spec.ts\` |`.trim();

        case 'swiftui': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| View | \`<Feature>View.swift\` | \`UserProfileView.swift\` |
| ViewModel | \`<Feature>ViewModel.swift\` | \`UserProfileViewModel.swift\` |
| UseCase | \`<Action>UseCase.swift\` | \`GetUserProfileUseCase.swift\` |
| Repository (protocol) | \`<Feature>Repository.swift\` | \`UserRepository.swift\` |
| DataSource | \`<Feature>DataSource.swift\` | \`UserRemoteDataSource.swift\` |
| Domain Model | \`<Entity>.swift\` | \`User.swift\` |
| Test | \`<Source>Tests.swift\` | \`UserProfileViewModelTests.swift\` |`.trim();

        case 'python': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Router/Blueprint | \`<resource>.py\` (snake_case) | \`users.py\`, \`user_orders.py\` |
| Service | \`<resource>_service.py\` | \`user_service.py\` |
| Repository | \`<resource>_repository.py\` | \`user_repository.py\` |
| ORM Model | \`<resource>.py\` (PascalCase class inside) | \`user.py\` → \`class User\` |
| Pydantic Schema | \`<resource>_schema.py\` | \`user_schema.py\` → \`UserCreate\`, \`UserResponse\` |
| Dependency factory | \`dependencies.py\` or \`deps.py\` | \`get_user_service()\` |
| Test | \`test_<resource>.py\` | \`test_users.py\`, \`test_user_service.py\` |`.trim();

        case 'nodejs': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Route | \`<resource>.routes.ts\` or \`<resource>Routes.ts\` | \`users.routes.ts\` |
| Controller | \`<resource>.controller.ts\` or \`<resource>Controller.ts\` | \`users.controller.ts\` |
| Service | \`<resource>.service.ts\` or \`<resource>Service.ts\` | \`usersService.ts\` |
| Repository | \`<resource>.repository.ts\` or \`<resource>Repository.ts\` | \`usersRepository.ts\` |
| DTO / Schema | \`<resource>.dto.ts\` or \`<resource>.schema.ts\` | \`createUser.dto.ts\` |
| Test | \`<source>.test.ts\` or \`<source>.spec.ts\` | \`usersService.test.ts\` |`.trim();

        case 'java': return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Controller | \`<Resource>Controller.java\` | \`UserController.java\` |
| Service (interface) | \`<Resource>Service.java\` | \`UserService.java\` |
| Service (impl) | \`<Resource>ServiceImpl.java\` | \`UserServiceImpl.java\` |
| Repository | \`<Resource>Repository.java\` (Spring Data interface) | \`UserRepository.java\` |
| Entity | \`<Resource>.java\` | \`User.java\` |
| DTO (request) | \`<Resource>Request.java\` or \`Create<Resource>Request.java\` | \`CreateUserRequest.java\` |
| DTO (response) | \`<Resource>Response.java\` | \`UserResponse.java\` |
| Test | \`<Source>Test.java\` or \`<Source>Tests.java\` | \`UserControllerTest.java\` |`.trim();

        default: return `
| Layer | File pattern | Example |
|-------|-------------|---------|
| Entry point | match existing convention | — |
| Business logic | match existing convention | — |
| Data access | match existing convention | — |
| Test | \`<source>.test\` or \`test_<source>\` | — |`.trim();
    }
}

function buildDirectoryNaming(c: GovernanceConfig): string {
    switch (c.stack) {
        case 'flutter':
            return `Feature folders inside \`lib/features/\` use **snake_case**: \`lib/features/user_profile/\`\nInside each feature: \`data/\`, \`domain/\`, \`presentation/\` sub-folders`;

        case 'kotlin':
            return `Feature packages use **lowercase** (Java package convention): \`com.app.userprofile\`\nFeature folders in \`app/src/main/kotlin/\` match the package path`;

        case 'react':
            return `Feature folders use **kebab-case**: \`src/features/user-profile/\`\nComponent folders use **PascalCase** if co-located with the component: \`src/components/UserProfile/\``;

        case 'angular':
            return `Feature folders use **kebab-case**: \`src/app/features/user-profile/\`\nNx library names use **kebab-case**: \`libs/user-profile/\``;

        case 'swiftui':
            return `Feature folders use **PascalCase**: \`Sources/App/Features/UserProfile/\`\nTest folders mirror source: \`Tests/AppTests/Features/UserProfile/\``;

        case 'python':
            return `Module directories use **snake_case**: \`app/api/users/\`, \`app/services/\`\nTest directories mirror source: \`tests/integration/\`, \`tests/unit/\``;

        case 'nodejs':
            return `Feature/resource folders use **camelCase** or **kebab-case** (match existing project convention)\nNestJS modules: \`src/users/\`, \`src/orders/\``;

        case 'java':
            return `Package directories use **lowercase** Java convention: \`src/main/java/com/app/user/\`\nTest directories mirror source: \`src/test/java/com/app/user/\``;

        default:
            return `Directory names should match the project's existing convention.`;
    }
}
