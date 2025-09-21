import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WhiteboardService {
	private readonly API_URL_UUID = 'https://api-cn-hz.netless.link/v5/rooms';
	private readonly API_URL_ROOM_TOKEN = 'https://api-cn-hz.netless.link/v5/tokens/rooms';
	
	// Agora Whiteboard credentials
	private readonly APP_IDENTIFIER = 'tmuA4P_vEe-XRGk9GboPXw/t7oX_QbCKG52Pw'; // App Identifier
	private readonly SDK_TOKEN = 'NETLESSSDK_YWs9bWN3MTZsVFI3OHlFZzdmOCZub25jZT02Zjc5ZGEyMC05NzA2LTExZjAtODNiMC0zOTdkNzA0Mjc4ZDgmcm9sZT0wJnNpZz03NzA1ZTBiOTI0YjczNDI4NGI4MTZkZWIxN2Y4OTlmZjVhZTMxYzFmZDc1YjQxMzE2ZTIzZjZjZTgxMWMxMzc2'; // SDK Token из Agora Console
	private readonly REGION = 'cn-hz';

	constructor(private readonly httpService: HttpService) {}

	/** Создаёт комнату и сразу получает Room Token */
	async createRoom(): Promise<{ roomUuid: string; roomToken: string }> {
		try {
			console.log('📡 Создаём новую комнату...');

			const headers = {
				token: this.SDK_TOKEN,
				region: this.REGION,
				'Content-Type': 'application/json',
			};

			const body = { isRecord: false };

			const response = await firstValueFrom(
				this.httpService.post(this.API_URL_UUID, body, { headers }),
			);

			const roomUuid = response.data.uuid;
			console.log('✅ Комната создана, UUID:', roomUuid);

			// Получаем токен
			const roomToken = await this.generateRoomToken(roomUuid, 'admin');
			console.log('✅ Room Token успешно получен:', roomToken);

			// Теперь точно возвращаем оба значения
			return { roomUuid, roomToken };
		} catch (error) {
			console.error('❌ Ошибка при создании комнаты:', error.response?.data || error.message);
			throw new HttpException('Не удалось создать комнату', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/** Генерирует Room Token */
	async generateRoomToken(roomUuid: string, role: 'admin' | 'writer' | 'reader', lifespan: number = 3600): Promise<string> {
		try {
			const headers = {
				token: this.SDK_TOKEN,
				region: this.REGION,
				'Content-Type': 'application/json',
			};

			const body = {
				lifespan, 
				role, 
			};

			const response = await firstValueFrom(
				this.httpService.post(`${this.API_URL_ROOM_TOKEN}/${roomUuid}`, body, { headers }),
			);
			console.log('✅ Room Token успешно получен в generatetoken:', response.data);
			return response.data;
		} catch (error) {
			console.error('❌ Ошибка при генерации Room Token:', error.response?.data || error.message);
			throw new HttpException('Не удалось создать Room Token', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/** Проксирует запросы к Agora API */
	async proxyAgoraRequest(url: string): Promise<any> {
		try {
			console.log('📡 Проксируем запрос к Agora API:', url);
			
			const response = await firstValueFrom(
				this.httpService.get(url, {
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					},
				}),
			);
			
			console.log('✅ Ответ от Agora API получен, статус:', response.status);
			console.log('✅ Данные ответа:', response.data);
			return response.data;
		} catch (error) {
			console.error('❌ Ошибка при проксировании к Agora API:');
			console.error('❌ Статус:', error.response?.status);
			console.error('❌ Данные ошибки:', error.response?.data);
			console.error('❌ Заголовки:', error.response?.headers);
			console.error('❌ Сообщение:', error.message);
			throw error;
		}
	}

}
