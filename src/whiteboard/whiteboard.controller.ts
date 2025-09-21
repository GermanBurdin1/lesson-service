import { Controller, Get, HttpException, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { WhiteboardService } from './whiteboard.service';
import { Request, Response } from 'express';

@Controller('lessons/whiteboard')
export class WhiteboardController {
	constructor(private readonly whiteboardService: WhiteboardService) {}

	/** Один запрос = создаёт комнату и сразу возвращает roomUuid + roomToken */
	@Post('create-room')
	async createRoomWithToken() {
		try {
			const result = await this.whiteboardService.createRoom();
			return result;
		} catch (error) {
			console.error('❌ Ошибка при создании комнаты и токена:', error);
			throw new HttpException('Ошибка при создании комнаты и токена', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/** Отдельный запрос для получения токена по UUID */
	@Get('get-room-token')
	async getRoomToken(
		@Query('roomUuid') roomUuid: string,
		@Query('role') role: 'admin' | 'writer' | 'reader',
		@Query('lifespan') lifespan?: number,
	) {
		if (!roomUuid || !role) {
			return { error: 'roomUuid и role обязательны' };
		}
		const token = await this.whiteboardService.generateRoomToken(roomUuid, role, lifespan);
		return { roomToken: token };
	}

	/** Прокси для Agora API - получает конфигурацию регионов */
	@Get('agora-proxy/*')
	async agoraProxy(@Req() req: Request, @Res() res: Response) {
		try {
			console.log('🔍 ПОЛНЫЙ URL ЗАПРОСА:', req.url);
			console.log('🔍 МЕТОД:', req.method);
			console.log('🔍 PATH:', req.path);
			console.log('🔍 QUERY:', req.query);
			
			// Извлекаем путь после agora-proxy
			const pathAfterProxy = req.url.replace('/lessons/whiteboard/agora-proxy', '');
			const agoraUrl = `https://api-us-sv.whiteboard.rtelink.com${pathAfterProxy}`;
			console.log('🔄 Проксируем запрос к Agora:', agoraUrl);
			
			const response = await this.whiteboardService.proxyAgoraRequest(agoraUrl);
			
			// Устанавливаем CORS заголовки
			res.header('Access-Control-Allow-Origin', '*');
			res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			
			console.log('✅ Успешно проксировали запрос к Agora');
			return res.json(response);
		} catch (error) {
			console.error('❌ Ошибка при проксировании к Agora:', error);
			console.error('❌ Детали ошибки:', error.response?.data || error.message);
			throw new HttpException('Ошибка при проксировании к Agora', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
