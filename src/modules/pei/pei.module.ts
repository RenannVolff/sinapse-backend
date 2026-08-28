import { Module } from '@nestjs/common';
import { PeiService } from './pei.service';
import { PeiController } from './pei.controller';

@Module({
  controllers: [PeiController],
  providers: [PeiService],
})
export class PeiModule {}
