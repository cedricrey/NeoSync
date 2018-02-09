#!/usr/bin/env node
/*Entree principale du service NeoSync, prennant en charge les arguments en entree puis lançant le service*/
NeoSync = require('./NeoSyncClass.js').NeoSync;
NeoSync.processArguments();	 
NeoSync.startService();
//console.log(neoSync.NeoSync);
