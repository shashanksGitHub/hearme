import { Global, Module } from '@nestjs/common';
import { GoogleTtsService } from './google-tts.service';

@Global()
@Module({
  providers: [GoogleTtsService],
  exports: [GoogleTtsService],
})
export class GoogleModule {}
