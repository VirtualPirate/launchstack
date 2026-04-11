/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module, SetMetadata, DynamicModule } from '@nestjs/common';

export const AllowAnonymous = () => SetMetadata('isPublic', true);
export const OptionalAuth = () => SetMetadata('isOptionalAuth', true);
export const Session = () => () => undefined;

@Module({})
export class AuthModule {
  static forRoot(_options: any): DynamicModule {
    return {
      module: AuthModule,
      global: true,
    };
  }

  static forRootAsync(options: any): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: options.imports || [],
      providers: options.useFactory
        ? [
            {
              provide: 'AUTH_MODULE_OPTIONS',
              useFactory: options.useFactory,
              inject: options.inject || [],
            },
          ]
        : [],
    };
  }
}
