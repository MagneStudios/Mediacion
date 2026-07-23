import type { Json } from "@mediacion/db-types";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { PropuestaConRespuestas } from "./acuerdos.types";

function acceptedPropuestaNotFound(): HttpException {
  return new HttpException(
    {
      code: "accepted_propuesta_not_found",
      message: "No accepted proposal for this case",
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function buildAgreementContent(
  accepted: PropuestaConRespuestas | undefined,
): Json {
  if (!accepted) {
    throw acceptedPropuestaNotFound();
  }
  const { propuesta, respuestas } = accepted;
  return {
    propuesta_id: propuesta.id,
    contenido: propuesta.contenido,
    fundamentacion: propuesta.fundamentacion,
    modelo_ia: propuesta.modelo_ia,
    respuestas: respuestas.map((respuesta) => ({
      parte_id: respuesta.parte_id,
      decision: respuesta.decision,
      fecha: respuesta.fecha,
    })),
  };
}
