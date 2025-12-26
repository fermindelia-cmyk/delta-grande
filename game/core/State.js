import { Save } from './Save.js';
import { EventBus } from './EventBus.js';


const DEFAULT = {
inventory: [], // [{id, name, whenISO}]
achievements: [], // [{id, name, whenISO}]
scores: { simulador: 0 },
fishCounts: {}, // { speciesId: count }
hasSeenIntro: false, // Track if user has seen the initial intro

// RioScene: one-time deck tutorial hint (hide permanently after N fish clicks)
rioDeckTagHintAttempts: 0,
rioDeckTagHintDismissed: false,
};


const data = Object.assign({}, DEFAULT, Save.load());


function commit(){ Save.save(data); }

export const State = {
get(){ return data; },


getRioDeckTagHintAttempts(){
	return Math.max(0, data.rioDeckTagHintAttempts | 0);
},

hasRioDeckTagHintDismissed(){
	return data.rioDeckTagHintDismissed === true;
},

incrementRioDeckTagHintAttempts(maxAttempts = 3){
	const max = Math.max(1, maxAttempts | 0);
	const next = (data.rioDeckTagHintAttempts | 0) + 1;
	data.rioDeckTagHintAttempts = Math.max(0, next);
	if (data.rioDeckTagHintAttempts >= max) {
		data.rioDeckTagHintDismissed = true;
	}
	commit();
	EventBus.emit('rio:deckTagHint', {
		attempts: data.rioDeckTagHintAttempts,
		dismissed: data.rioDeckTagHintDismissed
	});
},

dismissRioDeckTagHint(){
	if (data.rioDeckTagHintDismissed === true) return;
	data.rioDeckTagHintDismissed = true;
	commit();
	EventBus.emit('rio:deckTagHint', {
		attempts: data.rioDeckTagHintAttempts,
		dismissed: data.rioDeckTagHintDismissed
	});
},


addItem(item){
if (!data.inventory.find(x=>x.id===item.id)){
data.inventory.push({ ...item, whenISO: new Date().toISOString() });
commit(); EventBus.emit('inventory:changed');
}
},


addAchievement(ach){
if (!data.achievements.find(x=>x.id===ach.id)){
data.achievements.push({ ...ach, whenISO: new Date().toISOString() });
commit(); EventBus.emit('achievements:changed');
}
},


setHighScoreSimulador(score){
if (score > (data.scores.simulador||0)){
data.scores.simulador = score; commit(); EventBus.emit('scores:changed');
}
},


addFish(speciesId){
data.fishCounts[speciesId] = (data.fishCounts[speciesId]||0) + 1;
commit(); EventBus.emit('fish:changed', { speciesId });
},

markIntroSeen(){
data.hasSeenIntro = true;
commit();
},

hasSeenIntro(){
return data.hasSeenIntro === true;
},

resetAll(){
Object.assign(data, DEFAULT);
data.hasSeenIntro = false;
commit();
EventBus.emit('state:reset');
},

resetProgress(){
// Reset everything EXCEPT hasSeenIntro (to skip full intro on "new game")
Object.assign(data, DEFAULT);
data.hasSeenIntro = true;
commit();
EventBus.emit('state:reset');
}
};