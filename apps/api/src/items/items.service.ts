import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { MembershipService } from "../casos/membership.service";
import { ItemsRepository } from "./items.repository";
import type {
  CategoriaItem,
  CreateItemDto,
  OwnItem,
  UpdateItemDto,
} from "./items.types";
import { pickUpdatableFields } from "./update-allowlist";
import { assertValidRange } from "./valor-range";

const validCategorias: CategoriaItem[] = [
  "cuidado_ninos",
  "cronogramas",
  "bienes",
  "economico",
  "personalizado",
];

function assertValidCategoria(categoria: CategoriaItem): void {
  if (!validCategorias.includes(categoria)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: `categoria must be one of ${validCategorias.join(", ")}`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidNombre(nombre: unknown): void {
  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    throw new HttpException(
      { code: "invalid_input", message: "nombre is required" },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidCreateInput(input: CreateItemDto): void {
  assertValidNombre(input.nombre);
  assertValidCategoria(input.categoria);
  assertValidRange(input.valor_min, input.valor_max);
}

function assertValidUpdateInput(patch: UpdateItemDto): void {
  if (patch.categoria !== undefined) {
    assertValidCategoria(patch.categoria);
  }
  if (patch.nombre !== undefined) {
    assertValidNombre(patch.nombre);
  }
}

function assertHasUpdatableFields(updatable: UpdateItemDto): void {
  if (Object.keys(updatable).length === 0) {
    throw new HttpException(
      {
        code: "no_updatable_fields",
        message: "No updatable fields provided",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function itemNotFound(): HttpException {
  return new HttpException(
    { code: "item_not_found", message: "Item not found" },
    HttpStatus.NOT_FOUND,
  );
}

@Injectable()
export class ItemsService {
  constructor(
    @Inject(ItemsRepository) private readonly itemsRepository: ItemsRepository,
    @Inject(MembershipService)
    private readonly membershipService: MembershipService,
  ) {}

  async createOwnItem(
    casoId: string,
    callerId: string,
    dto: CreateItemDto,
  ): Promise<OwnItem> {
    await this.membershipService.assertMembership(casoId, callerId);
    assertValidCreateInput(dto);
    return this.itemsRepository.createOwn(dto, casoId, callerId);
  }

  async listOwnItems(casoId: string, callerId: string): Promise<OwnItem[]> {
    await this.membershipService.assertMembership(casoId, callerId);
    return this.itemsRepository.findOwn(casoId, callerId);
  }

  async getOwnItem(itemId: string, callerId: string): Promise<OwnItem> {
    const item = await this.itemsRepository.findOwnById(itemId, callerId);
    if (!item) {
      throw itemNotFound();
    }
    return item;
  }

  /**
   * A missing row and another parte's row are indistinguishable on purpose: the
   * delete is scoped by parte_id, so both collapse to the same 404.
   */
  async deleteOwnItem(itemId: string, callerId: string): Promise<void> {
    const deleted = await this.itemsRepository.deleteOwn(itemId, callerId);
    if (!deleted) {
      throw itemNotFound();
    }
  }

  async updateOwnItem(
    itemId: string,
    callerId: string,
    patch: UpdateItemDto,
  ): Promise<OwnItem> {
    assertHasUpdatableFields(pickUpdatableFields(patch));
    assertValidUpdateInput(patch);
    const updated = await this.itemsRepository.updateOwnWithLock(
      itemId,
      callerId,
      (current) => {
        const effectiveValorMin =
          patch.valor_min !== undefined ? patch.valor_min : current.valor_min;
        const effectiveValorMax =
          patch.valor_max !== undefined ? patch.valor_max : current.valor_max;
        assertValidRange(effectiveValorMin, effectiveValorMax);
        return patch;
      },
    );
    if (!updated) {
      throw itemNotFound();
    }
    return updated;
  }
}
