import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthClient {
  constructor(private readonly http: HttpService) {}

  async getUserInfo(userId: string): Promise<{ id: string; name: string; surname: string; photo_url?: string }> {
    //console.log('📘 [auth] getUser requête pour l\' id:', userId);
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

  async getUserByEmail(email: string): Promise<{ id: string; name?: string; email: string; is_email_confirmed: boolean } | null> {
    try {
      this.devLog(`[AUTH CLIENT] Looking for user with email: ${email}`);
      const url = `${process.env.AUTH_SERVICE_URL}/auth/users/by-email`;
      const { data } = await firstValueFrom(this.http.post(url, { email }));
      this.devLog(`[AUTH CLIENT] User found:`, data);
      return data;
    } catch (error) {
      this.devLog(`[AUTH CLIENT] User not found or error:`, error.message);
      return null;
    }
  }

  private devLog(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log(message, ...args);
    }
  }
}
