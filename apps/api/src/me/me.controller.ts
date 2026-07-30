import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser, MeProfile } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { MeService } from "./me.service";
import type { AccountActionResult, UpdateProfileDto } from "./me.types";
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesDto,
} from "./notification-preferences";

@Controller("me")
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  async getOwnProfile(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<MeProfile> {
    const profile = await this.meService.findOwnProfile(caller.id);
    if (!profile) {
      throw new HttpException(
        { code: "profile_not_found", message: "Profile not found" },
        HttpStatus.NOT_FOUND,
      );
    }
    return profile;
  }

  @Patch()
  updateOwnProfile(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ): Promise<MeProfile> {
    return this.meService.updateOwnProfile(caller.id, body);
  }

  @Get("preferencias-notificacion")
  getOwnNotificationPreferences(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<NotificationPreferences> {
    return this.meService.findNotificationPreferences(caller.id);
  }

  @Patch("preferencias-notificacion")
  updateOwnNotificationPreferences(
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.meService.updateNotificationPreferences(caller.id, body);
  }

  @Post("desactivacion")
  requestOwnDeactivation(
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<AccountActionResult> {
    return this.meService.requestDeactivation(caller.id);
  }
}
