import { Module } from '@nestjs/common';
import { PeiTemplateService } from './pei-template.service';
import { PeiTemplateController } from './pei-template.controller';

@Module({
  controllers: [PeiTemplateController],
  providers: [PeiTemplateService],
})
export class PeiTemplateModule {}
