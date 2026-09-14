export type CaseContextVisibility = 'shared' | 'private';

export type FamilyMember = {
  id: string;
  nombre: string;
  parentesco: string;
  fechaNacimiento?: string;
};

export type ChildActivity = {
  id: string;
  ninoId: string;
  nombre: string;
  diaSemana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  horaInicio: string;
  horaFin: string;
  lugar?: string;
};

export type SchoolInfo = {
  nombre: string;
  direccion?: string;
  turno: 'manana' | 'tarde' | 'doble';
};

export type WeeklyScheduleEntry = {
  id: string;
  diaSemana: ChildActivity['diaSemana'];
  horaInicio: string;
  horaFin: string;
  descripcion: string;
};

export type Address = {
  id: string;
  etiqueta: string;
  direccion: string;
};

export type Restriction = {
  id: string;
  tipo: 'viajes' | 'trabajo_por_turnos' | 'distancia' | 'otro';
  descripcion: string;
};

export type CaseContextSectionId =
  | 'integrantes'
  | 'actividades'
  | 'colegio'
  | 'cronograma'
  | 'domicilios'
  | 'restricciones';

export type CaseContextEntry<T> = {
  data: T;
  visibility: CaseContextVisibility;
  ownerId: string;
};

export type CaseContext = {
  caseId: string;
  integrantes: CaseContextEntry<FamilyMember>[];
  actividades: CaseContextEntry<ChildActivity>[];
  colegio: CaseContextEntry<SchoolInfo> | null;
  cronograma: CaseContextEntry<WeeklyScheduleEntry>[];
  domicilios: CaseContextEntry<Address>[];
  restricciones: CaseContextEntry<Restriction>[];
  completedSections: CaseContextSectionId[];
};
