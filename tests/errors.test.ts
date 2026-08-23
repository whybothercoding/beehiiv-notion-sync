import {
  SyncError,
  ConfigError,
  BeehiivApiError,
  BeehiivSchemaError,
  NotionApiError,
} from '../src/errors';

describe('typed errors', () => {
  it('SyncError subclasses report their own class name', () => {
    expect(new ConfigError('x').name).toBe('ConfigError');
    expect(new BeehiivApiError('x').name).toBe('BeehiivApiError');
    expect(new NotionApiError('x').name).toBe('NotionApiError');
  });

  it('every subclass is an instance of SyncError and Error', () => {
    const err = new ConfigError('missing key');
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toBeInstanceOf(Error);
  });

  it('BeehiivApiError carries the HTTP status', () => {
    const err = new BeehiivApiError('failed', 429);
    expect(err.status).toBe(429);
  });

  it('NotionApiError carries the Notion error code', () => {
    const err = new NotionApiError('failed', 'object_not_found');
    expect(err.notionCode).toBe('object_not_found');
  });

  it('BeehiivSchemaError folds issues into the message', () => {
    const err = new BeehiivSchemaError('bad shape', ['email: Required', 'status: Required']);
    expect(err.issues).toEqual(['email: Required', 'status: Required']);
    expect(err.message).toContain('email: Required');
    expect(err.message).toContain('status: Required');
  });

  it('preserves the original error via cause', () => {
    const original = new Error('network down');
    const err = new BeehiivApiError('wrapped', 500, { cause: original });
    expect(err.cause).toBe(original);
  });
});
