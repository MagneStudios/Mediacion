export type FamilyMember = {
  id: string;
  nombre: string;
  parentesco: string;
  fechaNacimiento?: string;
  notas?: string;
};

export type ChildActivity = {
  id: string;
  integranteId?: string;
  actividad: string;
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  horaInicio: string;
  horaFin: string;
  lugar?: string;
};

export type SchoolInfo = {
  nombre: string;
  direccion?: string;
  curso?: string;
  notas?: string;
  turno: 'manana' | 'tarde' | 'doble';
};

export type WeeklyScheduleEntry = {
  id: string;
  dia: ChildActivity['dia'];
  franjaHoraria: string;
  descripcion: string;
};

export type Address = {
  id: string;
  tipo: string;
  calle: string;
  numero?: string;
  localidad?: string;
  provincia?: string;
  cp?: string;
  notas?: string;
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
