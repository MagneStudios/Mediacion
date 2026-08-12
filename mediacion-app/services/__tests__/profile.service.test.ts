import { __resetMockProfile, createMockProfileService } from '../profile.service';

describe('requestAccountDeactivationMock — R-06 depuración scheduling', () => {
  // The mock store is module-level, not per-instance — createMockProfileService()
  // returns methods over the shared store, not a fresh one each call.
  // Resetting between tests is what actually isolates them.
  beforeEach(() => {
    __resetMockProfile();
  });

  it('sets depuracionProgramadaAt six months after the request timestamp', async () => {
    const service = createMockProfileService();
    const result = await service.requestAccountDeactivationMock();

    expect(result.status).toBe('requested');
    const requested = new Date(result.requestedAt);
    const depuracion = new Date(result.depuracionProgramadaAt);

    // Compare via calendar month arithmetic, not a fixed millisecond
    // delta — months have different lengths.
    const expected = new Date(requested);
    expected.setMonth(expected.getMonth() + 6);
    expect(depuracion.toISOString()).toBe(expected.toISOString());
  });

  it('is idempotent: a repeat call returns the original pair, never a new one', async () => {
    const service = createMockProfileService();
    const first = await service.requestAccountDeactivationMock();
    const second = await service.requestAccountDeactivationMock();

    expect(second).toEqual({
      status: 'already_requested',
      requestedAt: first.requestedAt,
      depuracionProgramadaAt: first.depuracionProgramadaAt,
    });
  });

  it('carries depuracionProgramadaAt into the profile alongside deactivationRequestedAt', async () => {
    const service = createMockProfileService();
    const result = await service.requestAccountDeactivationMock();
    const profile = await service.getProfile();

    expect(profile.deactivationRequestedAt).toBe(result.requestedAt);
    expect(profile.depuracionProgramadaAt).toBe(result.depuracionProgramadaAt);
  });

  it('never touches activo — a request is not a real deactivation', async () => {
    const service = createMockProfileService();
    const before = await service.getProfile();
    await service.requestAccountDeactivationMock();
    const after = await service.getProfile();

    expect(after.activo).toBe(before.activo);
  });
});
