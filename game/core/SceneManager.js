import { EventBus } from './EventBus.js';

export class SceneManager{
constructor(app, registry){
this.app = app;
this.registry = registry; // { name: () => new Scene(app) }
this.currentName = null;
this.instance = null;
}
async goTo(name){
const factory = this.registry[name];
if (!factory) throw new Error('Scene not found: '+name);
console.log(`[SceneManager] Changing from ${this.currentName} to ${name}`);
if (this.instance) {
  console.log(`[SceneManager] Unmounting ${this.currentName}`);
  await this.instance.unmount?.();
  console.log(`[SceneManager] Unmounted ${this.currentName}`);
}
this.instance = factory();
this.currentName = name;
console.log(`[SceneManager] Created new scene ${name}`);
await this.app.setScene(this.instance);
console.log(`[SceneManager] Set scene ${name} in app`);
// Emit scene changed event
EventBus.emit('scene:changed', name);
}
}