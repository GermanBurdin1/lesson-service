import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthClient {
  constructor(private readonly http: HttpService) {}

  async getUserInfo(userId: string): Promise<{ id: string; name: string; surname: string }> {
  console.log('📘 [auth] getUser запрос для id:', userId);
  const url = `http://auth-service:3001/auth/users/${userId}`; 
  const { data } = await firstValueFrom(this.http.get(url));
  return data;
}
}
