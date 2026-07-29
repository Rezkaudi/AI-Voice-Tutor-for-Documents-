import { AsyncEventQueue } from "@/application/services/async-event-queue";

export class SinkEventQueue<T> extends AsyncEventQueue<T> {
  override push(_item: T): void {
    return;
  }
}
