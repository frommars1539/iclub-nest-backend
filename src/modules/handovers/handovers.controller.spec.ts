import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../access/require-permission.decorator';
import { HandoversController } from './handovers.controller';

describe('HandoversController', () => {
  it('authorises confirm by party membership, so it declares no permission', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRED_PERMISSIONS_KEY,
        HandoversController.prototype.confirm,
      ),
    ).toBeUndefined();
    expect(
      reflector.get(REQUIRED_PERMISSIONS_KEY, HandoversController),
    ).toBeUndefined();
  });
});
