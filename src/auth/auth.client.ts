import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthClient {
  constructor(private readonly http: HttpService) {}

  async getUserInfo(userId: string): Promise<{ id: string; name: string; surname: string; photo_url?: string }> {
    console.log('📘 [auth] getUser requête pour l\' id:', userId);
    // const url = `http://auth-service:3001/auth/users/${userId}`; // docker
    const url = `${process.env.AUTH_SERVICE_URL}/auth/users/${userId}`;
    const { data } = await firstValueFrom(this.http.get(url));
    return data;
  }

  async getTeacherFullProfile(userId: string): Promise<any> {
    const url = `${process.env.AUTH_SERVICE_URL}/teacher-profile/full/${userId}`;
    const { data } = await firstValueFrom(this.http.get(url));
    return data;
  }
}
