import { Inject, Injectable } from "@nestjs/common";
import type { MeProfile } from "../auth/authenticated-user";
import { UsersRepository } from "../auth/users.repository";

@Injectable()
export class MeService {
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  findOwnProfile(callerId: string): Promise<MeProfile | undefined> {
    return this.usersRepository.findProfileById(callerId);
  }
}
