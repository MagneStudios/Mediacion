import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ModeracionRepository } from "./moderacion.repository";
import { findOffensiveTerms } from "./ofensivo-match";

export type TextoModerable = {
  campo: string;
  valor: string | null | undefined;
};

function textoOfensivo(campo: string): HttpException {
  return new HttpException(
    {
      code: "texto_ofensivo",
      message: "The text contains offensive language; rewrite it to continue",
      campo,
    },
    HttpStatus.BAD_REQUEST,
  );
}

@Injectable()
export class ModeracionService {
  private readonly logger = new Logger(ModeracionService.name);

  constructor(
    @Inject(ModeracionRepository)
    private readonly moderacionRepository: ModeracionRepository,
  ) {}

  /**
   * Corre antes de que el texto se procese o se muestre, y rechaza el request
   * entero: la parte reformula y vuelve a mandar. Se detiene en el primer
   * campo con un hallazgo porque el aviso nombra un campo, no una lista.
   *
   * La traza queda por ahora en el log del servicio. El pedido pide además
   * registro persistente para auditoría (`CAMBIOS-PACTUM-v2` §7), y esa tabla
   * es de DB (§1.2 de `pedidos-post-auditoria-14-09`): cuando exista, el
   * cuerpo de `traceEvent` pasa a escribirla y nada más de acá cambia.
   */
  async assertTextoAceptable(
    usuarioId: string,
    campos: readonly TextoModerable[],
  ): Promise<void> {
    const conTexto = campos.filter(
      (campo): campo is { campo: string; valor: string } =>
        typeof campo.valor === "string" && campo.valor.trim().length > 0,
    );
    if (conTexto.length === 0) {
      return;
    }
    const terminos = await this.moderacionRepository.readTerminos();
    if (terminos.length === 0) {
      return;
    }
    for (const campo of conTexto) {
      const found = findOffensiveTerms(campo.valor, terminos);
      if (found.length > 0) {
        this.traceEvent(usuarioId, campo.campo, found);
        throw textoOfensivo(campo.campo);
      }
    }
  }

  private traceEvent(
    usuarioId: string,
    campo: string,
    terminos: readonly string[],
  ): void {
    this.logger.warn(
      `moderacion bloqueó texto usuarioId=${usuarioId} campo=${campo} terminos=${terminos.join(",")}`,
    );
  }
}
