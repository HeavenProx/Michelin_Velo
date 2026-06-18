/// <reference types="jest" />
import type { Repository } from 'typeorm';
import { TyreModel } from './tyre-model.entity';
import { TyresService } from './tyres.service';

function makeTyre(overrides: Partial<TyreModel> = {}): TyreModel {
  return Object.assign(new TyreModel(), {
    id: 1,
    globalId: 'g-power-road',
    modelName: 'POWER ROAD',
    segment: 'ENDURANCE',
    useType: 'ENDURANCE',
    cycleTypeWeb: 'ROAD',
    lifetimeKm: 5000,
    priceRange: '45–75€',
    scoreWetGrip: 3,
    scoreRollingResistance: 3,
    scoreDurability: 3,
    scoreTerrainVersatility: 3,
    ...overrides,
  });
}

function makeRepo(
  overrides: Partial<Record<keyof Repository<TyreModel>, jest.Mock>> = {},
) {
  return {
    count: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as Repository<TyreModel>;
}

describe('TyresService', () => {
  describe('onApplicationBootstrap', () => {
    it("ne seede pas si la table n'est pas vide", async () => {
      const save = jest.fn().mockResolvedValue({});
      const repo = makeRepo({ count: jest.fn().mockResolvedValue(5), save });
      const service = new TyresService(repo);

      await service.onApplicationBootstrap();

      expect(save).not.toHaveBeenCalled();
    });

    it('seede le catalogue complet quand la table est vide', async () => {
      const save = jest.fn().mockResolvedValue({});
      const repo = makeRepo({
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockReturnValue({}),
        save,
      });
      const service = new TyresService(repo);

      await service.onApplicationBootstrap();

      expect(save).toHaveBeenCalled();
    });
  });

  describe('listModels', () => {
    it('filtre sur ROAD par défaut (sans bikeType)', async () => {
      const find = jest.fn().mockResolvedValue([makeTyre()]);
      const service = new TyresService(makeRepo({ find }));

      await service.listModels();

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cycleTypeWeb: 'ROAD' } }),
      );
    });

    it('filtre sur GRAVEL pour bikeType=GRAVEL', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = new TyresService(makeRepo({ find }));

      await service.listModels('GRAVEL');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cycleTypeWeb: 'GRAVEL' } }),
      );
    });

    it('filtre sur MTB pour bikeType=MTB', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = new TyresService(makeRepo({ find }));

      await service.listModels('MTB');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cycleTypeWeb: 'MTB' } }),
      );
    });

    it('retombe sur ROAD pour bikeType=E-BIKE (fallback)', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const service = new TyresService(makeRepo({ find }));

      await service.listModels('E-BIKE');

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cycleTypeWeb: 'ROAD' } }),
      );
    });

    it('mappe correctement TyreModel → TyreModelDto', async () => {
      const tyre = makeTyre({
        globalId: 'g-power-tlr',
        modelName: 'POWER ROAD TLR',
        segment: 'PERFORMANCE',
        useType: 'RACE',
        lifetimeKm: 4000,
        priceRange: '55–80€',
        scoreWetGrip: 5,
        scoreRollingResistance: 4,
        scoreDurability: 3,
        scoreTerrainVersatility: 2,
      });
      const service = new TyresService(
        makeRepo({ find: jest.fn().mockResolvedValue([tyre]) }),
      );

      const [dto] = await service.listModels();

      expect(dto).toEqual({
        globalId: 'g-power-tlr',
        name: 'POWER ROAD TLR',
        segment: 'PERFORMANCE',
        useType: 'RACE',
        lifetimeKm: 4000,
        priceRange: '55–80€',
        scores: {
          wetGrip: 5,
          rollingResistance: 4,
          durability: 3,
          terrainVersatility: 2,
        },
      });
    });

    it('retourne une liste vide si le repo ne renvoie rien', async () => {
      const service = new TyresService(
        makeRepo({ find: jest.fn().mockResolvedValue([]) }),
      );

      const result = await service.listModels();

      expect(result).toEqual([]);
    });
  });
});
