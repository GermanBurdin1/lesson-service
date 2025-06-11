import { DataSource } from 'typeorm';


export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'postgres-lesson',
  port: 5432,
  username: 'postgres',
  password: 'postgre',
  database: 'postgres',
  synchronize: false,
  logging: true,
  entities: [],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
