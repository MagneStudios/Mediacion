import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { RolUsuario } from "../auth/authenticated-user";
import { CarpetasRepository } from "./carpetas.repository";
import { EstudioMembershipService } from "./estudio-membership.service";
import { EstudiosRepository } from "./estudios.repository";
import type {
  CarpetaCreated,
  CasoConCarpeta,
  CasosByCarpeta,
  CreateCarpetaDto,
  MarcaConfig,
} from "./estudios.types";

function assertValidCreateCarpetaInput(input: CreateCarpetaDto): void {
  if (typeof input?.nombre !== "string" || input.nombre.trim().length === 0) {
    throw new HttpException(
      { code: "invalid_input", message: "nombre is required" },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertValidMarcaConfig(
  input: unknown,
): asserts input is Exclude<MarcaConfig, null> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new HttpException(
      {
        code: "invalid_input",
        message: "marca_config must be a JSON object",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function throwEstudioNotFound(): never {
  throw new HttpException(
    { code: "estudio_not_found", message: "Estudio not found" },
    HttpStatus.NOT_FOUND,
  );
}

function groupByCarpeta(rows: CasoConCarpeta[]): CasosByCarpeta[] {
  const groups = new Map<string, CasosByCarpeta>();
  const uncategorized: CasosByCarpeta["casos"] = [];

  for (const { carpeta_id, carpeta_nombre, ...caso } of rows) {
    if (carpeta_id === null) {
      uncategorized.push(caso);
      continue;
    }
    const existing = groups.get(carpeta_id);
    if (existing) {
      existing.casos.push(caso);
      continue;
    }
    groups.set(carpeta_id, {
      carpeta: { id: carpeta_id, nombre: carpeta_nombre ?? "" },
      casos: [caso],
    });
  }

  const result = Array.from(groups.values());
  if (uncategorized.length > 0) {
    result.push({ carpeta: null, casos: uncategorized });
  }
  return result;
}

@Injectable()
export class EstudiosService {
  constructor(
    @Inject(CarpetasRepository)
    private readonly carpetasRepository: CarpetasRepository,
    @Inject(EstudiosRepository)
    private readonly estudiosRepository: EstudiosRepository,
    @Inject(EstudioMembershipService)
    private readonly membershipService: EstudioMembershipService,
  ) {}

  async listCasos(
    callerId: string,
    callerRole: RolUsuario,
    pathId: string,
  ): Promise<CasosByCarpeta[]> {
    const estudioId = await this.membershipService.assertEstudioAccess(
      callerId,
      callerRole,
      pathId,
    );
    const rows = await this.carpetasRepository.listCasosByCarpeta(estudioId);
    return groupByCarpeta(rows);
  }

  async createCarpeta(
    callerId: string,
    callerRole: RolUsuario,
    pathId: string,
    input: CreateCarpetaDto,
  ): Promise<CarpetaCreated> {
    assertValidCreateCarpetaInput(input);
    const estudioId = await this.membershipService.assertEstudioAccess(
      callerId,
      callerRole,
      pathId,
    );
    const carpeta = await this.carpetasRepository.createCarpeta(
      estudioId,
      input.nombre,
    );
    return { id: carpeta.id };
  }

  async getMarcaConfig(
    callerId: string,
    callerRole: RolUsuario,
    pathId: string,
  ): Promise<{ marca_config: MarcaConfig }> {
    const estudioId = await this.membershipService.assertEstudioAccess(
      callerId,
      callerRole,
      pathId,
    );
    const estudio = await this.estudiosRepository.findOwn(estudioId);
    if (!estudio) {
      throwEstudioNotFound();
    }
    return { marca_config: estudio.marca_config };
  }

  async updateMarcaConfig(
    callerId: string,
    callerRole: RolUsuario,
    pathId: string,
    input: unknown,
  ): Promise<{ marca_config: MarcaConfig }> {
    assertValidMarcaConfig(input);
    const estudioId = await this.membershipService.assertEstudioAccess(
      callerId,
      callerRole,
      pathId,
    );
    const updated = await this.estudiosRepository.updateMarcaConfig(
      estudioId,
      input,
    );
    if (!updated) {
      throwEstudioNotFound();
    }
    return { marca_config: updated.marca_config };
  }
}
