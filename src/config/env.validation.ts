import type { ConfigService } from '@nestjs/config';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
  IsUrl,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() === 'true' : value;

/**
 * Schema for process environment. The app refuses to boot if this fails,
 * so misconfiguration surfaces at deploy time rather than on first request.
 * Inject as `ConfigService<EnvironmentVariables, true>` for typed access.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  /** Any value accepted by `jsonwebtoken` / `ms`, e.g. `15m`, `1h`, `7d`. */
  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '15m';

  /** Comma-separated list of allowed origins. Empty = allow all outside production. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Set when running behind a reverse proxy / load balancer so client IPs are correct. */
  @Transform(toBoolean)
  @IsBoolean()
  TRUST_PROXY: boolean = false;

  /** Defaults to enabled outside production. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

  /** Rate-limit window in milliseconds. */
  @IsInt()
  @Min(1)
  THROTTLE_TTL: number = 60_000;

  /** Max requests per client per window. */
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  /** Where the frontend runs; invitation links point here */
  @IsUrl({ require_tld: false })
  APP_URL: string = 'http://localhost:3000';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}

/** Swagger UI at /docs: on by default outside production, overridable via SWAGGER_ENABLED. */
export function isSwaggerEnabled(
  config: ConfigService<EnvironmentVariables, true>,
) {
  return (
    config.get('SWAGGER_ENABLED', { infer: true }) ??
    config.get('NODE_ENV', { infer: true }) !== Environment.Production
  );
}
