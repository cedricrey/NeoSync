var fs = require('fs'),
	https = require('https'),
	http = require('http'),
	path = require('path'),
	chokidar = require('chokidar'),
	querystring = require('querystring'),
	soap = require('soap'),
	pd = require('pretty-data').pd,
	dateFormat = require('dateformat'),
	FormData = require('form-data'),
	keypress = require('keypress'),

  	SoapHttpClient = require('./node_modules/soap/lib/http'); //Pour surcharge
	//Surcharge de la méthode handleResponse car suppression des commentaire ???
	SoapHttpClient.prototype.handleResponse = function(req, res, body) {
	  //debug('Http response body: %j', body);
	  if (typeof body === 'string') {
	    // Remove any extra characters that appear before or after the SOAP
	    // envelope.
	    /*
	    var match =
	      body.replace(/<!--[\s\S]*?-->/, "").match(/(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i);
	      */
	    var match =
	      body.match(/(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i);
	    if (match) {
	      body = match[0];
	    }
	  }
	  return body;
	};

var currentDb = {
	stringConcat : '+'
}

PromiseCounter = 0;
//console.log(Promise.prototype.toString);
var oldPromiseToString = Promise.prototype.toString;
Promise.prototype.toString = function(){
	/*
	var t = [];
	for(var i in this)
		t.push(i+" : " + this[i]);
	return t.join(',') ;
	*/
	if(this.identifier)
		return 'PROMISE_' + this.identifier;
	return this.constructor;
}
/*
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
*/
//console.log('Current exec dir : ' + __dirname);
//console.log('Current dir : ' + process.cwd());
function NeoSync( options ){
	options = options || {};
	//console.log( "NeoSync.config ? ", NeoSync.config)
	if(typeof NeoSync.config == "undefined" )
		NeoSync.initConfiguration();
	this.directory = options.directory || process.cwd();
	this.watching = options.watch || false;
	this.pushAll = options.pushAll || false;
	this.filePattern = options.filePattern || false;
	this.fetch = options.fetch || "";
	this.onFileRefresh = options.onFileRefresh || null;
	this.onFetchDone = options.onFetchDone || null;
	this.watchInPause = false;

	//console.log("NeoSync init : " + this.directory);
	//Init de la Promise principale pour charger le client Soap pour Write
	this.mainWorkflow = new Promise( function(resolve, reject){this.loadWriteClient( resolve );}.bind(this) );


	//this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){return new Promise( function(resolve, reject){console.log("WHat's this ???? ", this.constructor);this.loadFetchClient( resolve );}.bind(this))}.bind(this));
	//console.log("Adding loadFetchClient");
	this.pushAction( this.loadFetchClient );
	//Recuperation des token
	//this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){return new Promise( function(resolve, reject){this.sendSecurityLogon( resolve );}.bind(this))}.bind(this));
	//console.log("Adding sendSecurityLogon");
	this.pushAction( this.sendSecurityLogon );
	//Ecriture des token
	//this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){return new Promise( function(resolve, reject){this.addClientsTokensHeaders( ); resolve();}.bind(this))}.bind(this));
	//console.log("Adding addClientsTokensHeaders");
	this.pushAction( this.addClientsTokensHeaders, true );

	if(options.push)
		{
			//this.changeTriggered( options.push );
			//this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){return new Promise( function(push, resolve, reject){this.changeTriggered(push); resolve();}.bind(this, options.push))}.bind(this));
			
			this.pushAction( this.changeTriggered, true, options.push );
			return this;
		}
	if( this.fetch != "")
		{
			//this.processFetch( this.fetch );
			//this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){return new Promise( function(resolve, reject){this.processFetch( this.fetch ); resolve();}.bind(this))}.bind(this));
			//console.log("Adding processFetch");
			this.pushAction( this.processFetch, false, this.fetch );
			return this; //fin du traitement
		}

	var pattern = "";
	if(this.filePattern)
		pattern = path.sep + this.filePattern;

	//Watcher
	/*
	this.mainWorkflow = this.mainWorkflow.then( function(resolve, reject){
		return new Promise( function(resolve, reject){
			this.watcher = chokidar.watch(this.directory + pattern, {ignored: /^\./, persistent: true});
			this.watcher
			  .on('change', this.changeTriggered.bind(this) )
			  .on('error', function(error) { console.log('NeoSync Erreur', error); });
			  //.on('ready', function() {  }.bind(this));
			if( this.pushAll )
				this.watcher.on('add', this.changeTriggered.bind(this) );

			if( !this.watching )
				this.watcher
			  		.on('ready', function() { this.watcher.close(); }.bind(this));
			 else
				this.watcher
			  		.on('ready', function() { this.watcher.on('add', this.changeTriggered.bind(this) ); }.bind(this));
 		}.bind(this));
	}.bind(this));
	*/



		//console.log("I will watch")
	//this.pushAction( 

	//Pacth : If no watching, and no Push All, then stop now
		if(!this.watching && !this.pushAll )
			return this;

		var launchWatcher = function( onFinish ){
			console.log("I wanna watch :", this.watching);
			this.watcher = chokidar.watch(this.directory + pattern, {ignored: /^\./, persistent: true});
			this.watcher
			  .on('change', this.changeTriggered.bind(this) )
			  .on('error', function(error) { console.log('NeoSync Erreur', error); onFinish(); });
			  //.on('ready', function() {  }.bind(this));
			if( this.pushAll )
				this.watcher.on('add', this.changeTriggered.bind(this) );

			if( !this.watching 
)				this.watcher
			  		.on('ready', function() { this.watcher.close(); onFinish(); }.bind(this));
			 else
				{
				this.watcher
		  			.on('ready', function() { this.watcher.on('add', this.changeTriggered.bind(this) ); }.bind(this));
		  		console.log("Watching directory", this.directory + pattern)
				keypress(process.stdin);
				console.log("Press Any Key Top Stop")
				process.stdin.on('keypress', function (onFinish, ch, key) {
					  //console.log('got "keypress"', key);
					  /*
					  if (key && key.ctrl && key.name == 'c') {
					    process.stdin.pause();
					  }
					  */
					  process.stdin.pause();
					  this.watcher.close();
					  onFinish();
					}.bind( this, onFinish ));
				process.stdin.setRawMode(true);
				process.stdin.resume();
				}
			}.bind(this);
	this.watcherWorklfow = this.mainWorkflow.then(
		function(actionFunction, args, resolve, reject){
			//console.log(resolve)
			//console.log("Push 9999 Promise Action sync ? ", sync, actionFunction );
			return new Promise( function(resolve, reject){ launchWatcher( resolve, reject ) });
		}
	);
	//}.bind(this), false );
 		/*
	 var promise = new Promise((resolve, reject) => {
  	 	console.log("I'm ready");
  	 	resolve("I'm done")
	 });
	Promise.all([promise]).then(values => { 
	  console.log(values); 
	});
	*/

	 return this;
}
NeoSync.prototype.pushAction = function( actionFunction, sync, args ){
	
	if( sync )
	{
	//console.log("Push Action sync ? " , this.name, args, this.mainWorkflow );
	this.mainWorkflow = this.mainWorkflow.then(
		function(actionFunction, args, resolve, reject){
			//console.log("I WILL run synchronous function,", this.name, args);
			//console.log("Push 9999 Promise Action sync ? ",  actionFunction );
			var np = new Promise( function(actionFunction, args, resolve, reject){
				//console.log("I run synchronous function,", this.name, args);
				actionFunction.bind(this)( args, resolve, reject );
				resolve();
				//this.mainWorkflow.resolve();
				//console.log("OK, function raAAAn,", this.name, this.mainWorkflow, args);
			}.bind(this, actionFunction, args ) );
			return np;
		}.bind(this, actionFunction, args ) 
	);

	this.mainWorkflow.catch( ( error )  => { //console.log( "Error on a process ",error )
		NeoSync.displayError( "Error on a process\n" + JSON.stringify( error , null, 1).replace(/{|}/g,'') );
		});
	}


	else
	{	
	//console.log("Push Action Async ? " , this.name, actionFunction );
	this.mainWorkflow = this.mainWorkflow.then(
		function(actionFunction, args, resolve, reject){
			//console.log(resolve)
			//console.log("Push 9999 Promise Action sync ? ", sync, actionFunction );
			var np = new Promise( function(actionFunction, args, resolve, reject){
				//console.log("I run asynchronous function : ", actionFunction);
					//console.log("I run Aynchronous function,", this.name, actionFunction);
					actionFunction.bind(this)( resolve, reject, args );
			}.bind(this, actionFunction, args ) );
			return np;
		}.bind(this, actionFunction, args ) 
	);

	this.mainWorkflow.catch( ( error )  => { //console.log( "Error on a process ",error )
		NeoSync.displayError( "Error on a process\n" + JSON.stringify( error , null, 1).replace(/{|}/g,'') );
		});
	}
	this.mainWorkflow.identifier = PromiseCounter++;
	//if(this.mainWorkflow.identifier == 3)
	//console.log(this.mainWorkflow.toString() + " = "  + args + " \n\n\n {{{{----- \n" + actionFunction +"\n ---}}}}\n" + this.pushAction.caller.name );
}
NeoSync.prototype.getPromises = function(){
	if(this.watcherWorklfow )
		return [this.mainWorkflow, this.watcherWorklfow];
	return [this.mainWorkflow]
}

NeoSync.prototype.loadWriteClient = function( onLoaded, onError, logonRequest ){
	//LOADWRITECLIENT
	soap.createClient(NeoSync.config.xtkSessionWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp"},function(onLoaded, onError, err, client) {
	//console.log("got the Soap Client and resolve is ", typeof onLoaded);
				if( err &&  onError)
					{
						onError( err );
						return;
					}
				this.soapWriterClient = client;
				if( onLoaded )
					onLoaded();
		  	}.bind(this, onLoaded, onError));

};

NeoSync.prototype.loadFetchClient = function( onLoaded, onError ){
	soap.createClient(NeoSync.config.xtkQueryDefWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp", preserveWhitespace : true},function(onLoaded, onError, err, client) {
		//console.log("******* got the soapQueryClient Soap Client and this is ", this);
				if( err &&  onError)
					{
						onError(  err );
						return;
					}
			this.soapQueryClient = client;
			if( onLoaded )
				onLoaded.bind(this)("loadFetchClient done");
	  }.bind(this, onLoaded, onError));
};

//Obsolete ?
NeoSync.prototype.getSecurityToken = function( onLoaded, onError ){
	//console.log("getSecurityToken");
    if(!this.soapQueryClient)
    	this.loadWriteClient( this.sendSecurityLogon.bind( this, onLoaded ), onError, true );
    else
    	this.sendSecurityLogon(onLoaded, onError);
};

NeoSync.prototype.sendSecurityLogon = function( onLoaded, onError ){
	this.soapWriterClient.Logon({sessiontoken : "",
							 strLogin :  NeoSync.config.userName ,
							 strPassword : NeoSync.config.userPwd ,
							 elemParameters : ""}, function(onLoaded, onError, err, result, raw, soapHeader) {
      		if(err)
      			{
      			onError( err );
      			return
      			}

      		this.securityToken = result.pstrSecurityToken.$value;
      		NeoSync.config.sessionToken = result.pstrSessionToken.$value;
      		if(typeof onLoaded == "function")
      			onLoaded.bind(this)("sendSecurityLogon done");
		  }.bind(this, onLoaded, onError));
};


NeoSync.prototype.addClientsTokensHeaders = function( args, resolve, reject ){
	//addClientsTokensHeaders
		try{
					this.soapQueryClient.addHttpHeader('X-Security-Token', this.securityToken);
					this.soapQueryClient.addHttpHeader('cookie',  "__sessiontoken=" + NeoSync.config.sessionToken);
					this.soapWriterClient.addHttpHeader('X-Security-Token', this.securityToken);
					this.soapWriterClient.addHttpHeader('cookie',  "__sessiontoken=" + NeoSync.config.sessionToken);
				//console.log('HEHE jai les tokens',args);
				resolve("ClientsTokensHeaders added");
			}
		catch( err ){
			reject( err );
		}
}

NeoSync.prototype.changeTriggered = function( filePath ){
	if(this.watchInPause)
		return true;
	console.log("changeTriggered = " + filePath );
	//this.currentFilePath = path;
    if(!this.soapQueryClient)
    	this.loadWriteClient( this.processFile.bind( this, filePath ) );
    else
    	this.processFile(filePath);

};
NeoSync.prototype.pauseWatch = function(){
	this.watchInPause = true;
};
NeoSync.prototype.playWatch = function(){
	this.watchInPause = false;
};
NeoSync.sourcesFilesExt = ['js','jst','jssp','txt','html','iview.txt','iview.html'];
NeoSync.standardFilesExt = ['txt','html','iview.txt','iview.html'];
NeoSync.prototype.processFile = function( filePath ){
	//var filePath = this.currentFilePath;
	var contentFile = fs.readFileSync( filePath );
	var nFile = NeoSync.File( filePath );
	//Fichier caché, on ne traite pas
	if(nFile.fileName.indexOf('.') == 0)
		return true;
	//SECURITE : Mode non développeur (serveur != de la dev) et fichier de developpement, on sort
	if(NeoSync.config.mode == 'standard' && NeoSync.standardFilesExt.indexOf( nFile.extension ) == -1)
		return true;

	if( NeoSync.sourcesFilesExt.indexOf( nFile.extension ) != -1 )
		contentToSend = NeoSync.getXMLSourceFile( nFile, contentFile );
	else if( nFile.extension.toLowerCase() == 'xml')
		contentToSend = contentFile;
	console.log( "NeoSync : envoi du contenu de " + nFile.fileName );

	//console.log( contentToSend );

	var conf = NeoSync.config;
	try{
		this.backup( NeoSync.getFetchFromFile( filePath ) );
	}
	catch( e ){
			console.log( "NeoSync : echec de sauvegarde " + nFile.fileName );
	}
	this.pushAction( function( contentToSend, onLoad, onError ){
		this.soapWriterClient.Write({sessiontoken : NeoSync.config.sessionToken,
									domDoc : {$xml : contentToSend} }, function(onLoad, err, result, raw, soapHeader) {
		      		if(err)
		      			{
		      				console.log("Error when sending content !!!" , err)
		      				onError.bind(this)(); return;
		      			}
		      				console.log("Content Sent!!!" , raw);
		      		if(typeof this.onFileRefresh == "function")
		      			this.onFileRefresh( {nFile : nFile, result : result, error : err} );
		      		if( onLoad )
		      			onLoad.bind(this)();
				  }.bind(this,onLoad));
	}.bind(this, contentToSend));
};

NeoSync.getXMLSourceFile = function( neoFile, content){
	var xml;

	switch( neoFile.extension )
	{
		case 'js': xml = "<javascript xtkschema='xtk:javascript' name='"+ neoFile.xmlName +".js' namespace='"+ neoFile.nameSpace +"' ><data><![CDATA[$CONTENT]]></data></javascript>";break;
		case 'jst': xml = "<jst xtkschema='xtk:jst' name='"+ neoFile.xmlName +"' namespace='"+ neoFile.nameSpace +"' ><code><![CDATA[$CONTENT]]></code></jst>";break;
		case 'jssp': xml = "<jssp xtkschema='xtk:jssp' name='"+ neoFile.xmlName +".jssp' namespace='"+ neoFile.nameSpace +"' ><data><![CDATA[$CONTENT]]></data></jssp>";break;
		case 'sql': xml = "<sql xtkschema='xtk:sql' name='"+ neoFile.xmlName +".jssp' namespace='"+ neoFile.nameSpace +"' ><data><![CDATA[$CONTENT]]></data></sql>";break;
		case 'txt' : xml = "<delivery xtkschema='nms:delivery' internalName='"+ neoFile.internalName +"' _operation='update'><content><text><source><![CDATA[$CONTENT]]></source></text></content></delivery>";break;
		case 'html' : xml = "<delivery xtkschema='nms:delivery' internalName='"+ neoFile.internalName +"' _operation='update'><content><html><source><![CDATA[$CONTENT]]></source></html></content></delivery>";break;
		case 'iview.txt' : xml = "<includeView xtkschema='nms:includeView' name='"+ neoFile.internalName +"' _operation='update'><source><text><![CDATA[$CONTENT]]></text></source></includeView>";break;
		case 'iview.html' : xml = "<includeView xtkschema='nms:includeView' name='"+ neoFile.internalName +"' _operation='update'><source><html><![CDATA[$CONTENT]]></html></source></includeView>";break;
		default : xml = "<xml>";
	}
	//content = content.toString().replace(/<!\[CDATA\[/gi, '&lt;![CDATA[').replace(/\]\]>/gi,']]&gt;');
	xml = xml.replace("$CONTENT", content);
	return xml;
};
NeoSync.File = function( filePath ){
	var extensionReg = /\.([^.]*$)/;
	var specialExtensionReg = /\.((?:iview|bloc)\.[^.]*$)/;
	var fileExtension = "";
	var fileNameReg = "\\" + path.sep + "([^\\" + path.sep + "]*$)";
	var fileName = "";
	var internalNameReg = "([^\.]*)";
	var internalName = "";
	if( filePath.match(specialExtensionReg) && filePath.match(specialExtensionReg).length > 1 )
		fileExtension = filePath.match(specialExtensionReg)[1];
	else if( filePath.match(extensionReg) && filePath.match(extensionReg).length > 1 )
		fileExtension = filePath.match(extensionReg)[1];
	if( filePath.match(fileNameReg) && filePath.match(fileNameReg).length > 1 )
		fileName = filePath.match(fileNameReg)[1];
	if( fileName.match(internalNameReg) && fileName.match(internalNameReg).length > 1 )
		internalName = fileName.match(internalNameReg)[1];

	var namePos = fileName.indexOf("_") + 1;
	var nameLength = fileName.length - fileExtension.length - namePos - 1;
	var xmlName = fileName.substr( namePos , nameLength );//.replace("_",":");
	var nameSpace = fileName.substr(0, fileName.indexOf("_") );



	return {
		extension : fileExtension,
		fileName : fileName,
		xmlName : xmlName,
		nameSpace : nameSpace,
		internalName : internalName //tout le nom sans l'extension (.html, .txt etc.)
	};
};
NeoSync.directories = new Array();
NeoSync.newFetches = new Array();
NeoSync.watching = false;
NeoSync.pushAll = false;
NeoSync.initPattern = null;
NeoSync.stopOnError = true;
NeoSync.processArguments = function(){
	for(var i in process.argv)
		{
			if(process.argv[i] == '-d' && process.argv.length > i)
				NeoSync.directories = NeoSync.processDirectories( process.argv[ (parseInt(i)+1) ] );
			if(['-f','-fetch'].indexOf( process.argv[i].toLowerCase() ) != -1 && process.argv.length > i)
				NeoSync.newFetches = NeoSync.processFetches( process.argv[ (parseInt(i)+1) ] );
			if(['-w','-watch'].indexOf( process.argv[i].toLowerCase() ) != -1)
				NeoSync.watching = true;
			if(['-pa','-pushall'].indexOf( process.argv[i].toLowerCase() ) != -1)
				NeoSync.pushAll = true;
			if(['-ns','-noStop'].indexOf( process.argv[i].toLowerCase() ) != -1)
				NeoSync.stopOnError = false;
			if(['-pattern'].indexOf( process.argv[i].toLowerCase() ) != -1 && process.argv.length > i)
				NeoSync.filePattern = process.argv[ (parseInt(i)+1) ];
			if(['-p','-push'].indexOf( process.argv[i].toLowerCase() ) != -1 && process.argv.length > i)
				NeoSync.processPushes( process.argv[ (parseInt(i)+1) ] );
		}
	
	if( NeoSync.directories.length == 0)
		NeoSync.directories.push( process.cwd() );
	
	
};
NeoSync.processDirectories = function( argument ){
	var args = argument.split(";");
	var directories = new Array();
	for(var i in args)
		{
			if(args[i].indexOf('/') != 0)
				directories.push( process.cwd() + path.sep + args[i]);
			else
				directories.push( args[i]);
		}
	return directories;
};
NeoSync.processFetches = function( argument ){
	//PROCESS FETCHES
	var args = argument.split(";");
	var files = new Array();
	for(var i in args)
		{
			if(args[i].indexOf('/') != 0)
				files.push( process.cwd() + path.sep + args[i]);
			else
				files.push( args[i]);
		}
	return files;
};
NeoSync.processPushes = function( argument ){
	var args = argument.split(";");
	var files = new Array();
	for(var i in args)
		{
			var file = "";
			if(args[i].indexOf('/') != 0)
				file = process.cwd() + path.sep + args[i];
			else
				file =  args[i];
		var ns = new NeoSync({ push : file });
		}
	//return files;
};

NeoSync.configFile = getUserHome() + path.sep + 'NeoSync' + path.sep + 'neoSync.conf';
NeoSync.initConfiguration = function(){
	var initFile = NeoSync.configFile;
	//console.log( initFile );
	try{
		var configLines = fs.readFileSync( initFile );
	}
	catch( err ){
		console.log( "NeoSync Erreur au chargement de la config : " + err);
		throw "NeoSync Config Read Error";
	}
	NeoSync.config = JSON.parse( configLines );
	NeoSync.config.sessionToken = NeoSync.config.userName + "/" + NeoSync.config.userPwd;
	NeoSync.config.xtkSessionWSDL = getUserHome() + path.sep + 'NeoSync' + path.sep + 'wsdl_xtksession.xml';
	NeoSync.config.xtkQueryDefWSDL = getUserHome() + path.sep + 'NeoSync' + path.sep + 'wsdl_xtkquerydef.xml';
	NeoSync.config.mode = 'standard';
	NeoSync.config.configFileName = path.basename(initFile);
	if( NeoSync.config.devMode == 1 )
		NeoSync.config.mode = 'dev';


	NeoSync.displayWelcome();


};
NeoSync.getConfigurations = function(){
	var confDir = getUserHome() + path.sep + 'NeoSync' + path.sep ;
	var files = fs.readdirSync(confDir);
	var confFiles = new Array();
	for(var f in files)
		if(files[f].match("neoSync.*\.conf$") && files[f] != "neoSyncServer.conf")
			{
			//console.log( files[f]);
			confFiles.push(files[f]);
			}
	return confFiles;
};
NeoSync.startService = function(){
	NeoSync.initConfiguration();

	var allPromises = new Array();

	NeoSync.directories.forEach(function(directory){
		var neoSync = new NeoSync({ directory : directory, watch : NeoSync.watching, pushAll : NeoSync.pushAll, filePattern : NeoSync.filePattern });
		var promise = neoSync.getPromises()
		//console.log(promise, promise.toString() );
		allPromises = allPromises.concat( promise );
	});
	NeoSync.newFetches.forEach(function(fetch){
		var neoSync = new NeoSync({ fetch : fetch});
		var promise = neoSync.getPromises()
		//console.log(promise, promise.toString() );
		allPromises = allPromises.concat( promise );
	});

	Promise.all( allPromises ).then(function(values){		
		//return new Promise( (resolve, reject ) => {				
			//console.log("HEHOOOO J'AI FINI",values)
			NeoSync.displayGoodBye();
		//});
	})
	.catch(function(values){		
		//return new Promise( (resolve, reject ) => {				
			//console.log("HEHOOOO J'AI FINI",values)
			NeoSync.displayGoodBye();
		//});
	});
	
	//setInterval(function(){		console.log("allPromises : " + allPromises);	}.bind(this),10)
};	
var colors = {
		Reset : "\x1b[0m",
		cyan : "\x1b[36m",
		white : "\x1b[37m",
		Bright : "\x1b[1m",
		Dim : "\x1b[2m",
		Underscore : "\x1b[4m",
		Blink : "\x1b[5m",
		Reverse : "\x1b[7m",
		Hidden : "\x1b[8m",
		FgBlack : "\x1b[30m",
		FgRed : "\x1b[31m",
		FgGreen : "\x1b[32m",
		FgYellow : "\x1b[33m",
		FgBlue : "\x1b[34m",
		FgMagenta : "\x1b[35m",
		FgCyan : "\x1b[36m",
		FgWhite : "\x1b[37m",
		BgBlack : "\x1b[40m",
		BgRed : "\x1b[41m",
		BgGreen : "\x1b[42m",
		BgYellow : "\x1b[43m",
		BgBlue : "\x1b[44m",
		BgMagenta : "\x1b[45m",
		BgCyan : "\x1b[46m",
		BgWhite : "\x1b[47m"
	}
NeoSync.displayWelcome = function(){
	var str = {
		Entete : "------******------",
		logo1  : colors.cyan + "      █║    ▄██║                                                   "+colors.white,
		logo2  : colors.cyan + "     ██║    ██║                     ▄██████║                       "+colors.white,
		logo3  : colors.cyan + "    ███║   ▄██║  <------------+    ▄█▀   ▀║                        "+colors.white,
		logo4  : colors.cyan + "   ████║  ▄██║                    ██║          <---------------+   "+colors.white,
		logo5  : colors.cyan + "  ██████▄ ███       ▄█▄      ▄▄    ██▄                             "+colors.white,
		logo6  : colors.cyan + "  ██████████║    ▄█║  ║▄   ▄█▀▀█▄   ▀██▄   ▀▄     █▀   ▄           "+colors.white,
		logo7  : colors.cyan + " ▄██▀ █████║    ▄██▄▄▄▀▀  █║    █      ▀█▄   █║  █║   ▄█▀▀█▄    ▄▀▀"+colors.white,
		logo8  : colors.cyan + " ██║   ████║    ▀█║       █║    █ ░     ██   ▀║ █║   ▄║   █║  ▄█║  "+colors.white,
		logo9  : colors.cyan + " ██║    ███║     ▀█║  ▄▄▀ ▀█║  ▄▀ █║   ▄██    █║     █║   █║  █║   "+colors.white,
		logo10 : colors.cyan + " ██║     ██║       ▀██▀    ▀██▀   ▀█████▀     █║     █║   █║   ▀█▄▀"+colors.white,
		logo11 : colors.cyan + "                                             ▄▀                    "+colors.white,
		logo12 : colors.cyan + "                                           ▄▀▀                     "+colors.white,
		logo13 : colors.cyan + "  +------------------------------------>  ▄▀   +------------------>"+colors.white,
		Hello :  "Hello  " + NeoSync.config.userName,
		Welcome : "Welcome to NeoSync, link bettwen you and " + NeoSync.config.server,
		Footer : "___________--******--___________"
	}
	NeoSync.displayCartouche( str );
}
NeoSync.displayGoodBye = function(){
	var str = {
		Entete : "------  *  ------",
		bye :  "Good Bye " + NeoSync.config.userName,
		close : "Connection closed",
		Entete2 : "------  *  ------",
		bye1 : "♦─"+colors.cyan +"▄█▀▀║░▄█▀▄║▄█▀▄║██▀▄║"+colors.white +"─♦",
		bye2 : "♦─"+colors.cyan +"██║▀█║██║█║██║█║██║█║"+colors.white +"─♦",
		bye3 : "♦─"+colors.cyan +"▀███▀║▀██▀║▀██▀║███▀║"+colors.white +"─♦",
		bye4 : "♦───────────────────────♦",
		bye5 : "♦───"+colors.cyan +"▐█▀▄─ ▀▄─▄▀ █▀▀──█"+colors.white +"──♦",
		bye6 : "♦───"+colors.cyan +"▐█▀▀▄ ──█── █▀▀──▀"+colors.white +"──♦",
		bye7 : "♦───"+colors.cyan +"▐█▄▄▀ ──▀── ▀▀▀──▄"+colors.white +"──♦",
		Footer : "___________--****--___________"
	}
	NeoSync.displayCartouche( str );
}
NeoSync.displayError = function( error ){
	var str = error.split('\n');
	
	for(var i in str)
		str[i] = colors.FgRed + str[i] + colors.Reset;
	NeoSync.displayCartouche( str );	
}
NeoSync.displayCartouche = function( str /*Object*/){

	var cols = colors.FgYellow + "║"+ colors.Reset;

	var screenLength = 150;
	var sll = {};
	for(var k in str)
		{
			sll[k] =  2 * Math.round( (screenLength - (str[k].replace(/\x1b\[[0-9]*m/g,"")).length) / 2); 
			//console.log(str[k], str[k].replace(/\x1b\[[0-9]*m/g,"").replace(/─/g,"*"))
		}
		//sll[k] = 2 * Math.round( (screenLength - str[k].replace(/\\x1b\[[0-9;]*m/g,"").length) / 2); //Pour avoir un chiffre rond

	var cfNamelength = NeoSync.config.userName.toString().length;
	//console.log(" ");
	//console.log(" ");
	console.log(colors.FgYellow+"╔"+ Array(screenLength+1).join("═") +"╗"+colors.Reset);
	
	for(var k in str)
		{ 
		var p1 = Array((sll[k]/2)+1).join(" "), 
			l2 = screenLength - p1.length - str[k].replace(/\x1b\[[0-9]*m/g,"").length, 
			p2 = Array(l2+1).join(" ");
		console.log(cols + p1 +  str[k]  + p2 + cols );
		}
	/*
	console.log("║"+ Array((sll.Entete/2)+1).join(" ") + str.Entete + Array((sll.Entete/2)+1).join(" ") + "║");
	console.log("║"++"║");
	*/
	//console.log();
	console.log(colors.FgYellow+"╚"+ Array(screenLength+1).join("═") +"╝"+colors.Reset);
	//console.log(" ");
	console.log(" ");
}

/*
NeoSync.onSoapClientReady = function(){
	NeoSync.directories.forEach(function(directory){
		var neoSync = new NeoSync({ directory : directory, watch : NeoSync.watching, pushAll : NeoSync.pushAll});
	});
};
*/
NeoSync.querySelectors = {
	'xtk:javascript' : '<node expr="data"/>',
	'xtk:jst' : '<node expr="data"/>',
	'xtk:jssp' : '<node expr="data"/>',
	'xtk:sql' : '<node expr="data"/>',
	'xtk:workflow' : '<node expr="data"/><node expr="@label"/><node expr="@internalName"/><node expr="@isModel"/><node expr="[/]"/><node expr="@showSQL"/><node expr="@keepResult"/><node expr="@schema"/><node expr="@recipientLink"/><node anyType="true" expr="script"/><node expr="@builtIn"/><node expr="@modelName"/><node expr="@form"/><node anyType="true" expr="variables"/>',
	'xtk:form' : '<node expr="data"/><node expr="@xtkschema"/>',
	'xtk:srcSchema' : '<node expr="data"/><node expr="@xtkschema"/>',
	//'nms:delivery' : '<node expr="data"/><node expr="@internalName"/><node expr="@isModel"/><node expr="@deliveryMode"/><node expr="@label"/><node expr="[folder/@name]"/><node expr="[folderProcess/@name]"/><node expr="[mapping/@name]"/><node expr="[typology/@name]"/><node expr="[operation/@internalName]"/><node expr="[deliveryProvider/@name]"/><node expr="@xtkschema"/>',
//PATCH : cas du module Campaign non installé, pas d'opération dispo
	'nms:delivery' : '<node expr="data"/><node expr="@internalName"/><node expr="@isModel"/><node expr="@deliveryMode"/><node expr="@label"/><node expr="[folder/@name]"/><node expr="[folderProcess/@name]"/><node expr="[mapping/@name]"/><node expr="[typology/@name]"/><node expr="[deliveryProvider/@name]"/><node expr="@xtkschema"/>',
	'nms:delivery_html' : '<node expr="[content/html/source]"/>',
	'nms:delivery_txt' : '<node expr="[content/text/source]"/>',
	'nms:includeView' : '<node expr="data"/><node expr="@name"/><node expr="@label"/><node expr="[folder/@name]"/><node expr="\'nms:includeView\'" alias="@xtkschema"/>',
	'nms:includeView_html' : '<node expr="[source/html]"/>',
	'nms:includeView_txt' : '<node expr="[source/text]"/>',
	'ncm:content' : '<node expr="data"/><node expr="@xtkschema"/><node expr="@editForm"/><node expr="@name"/><node expr="@label"/><node expr="[@publishing-name]"/><node expr="[@publishing-namespace]"/><node expr="[channel/@name]"/>'
};
NeoSync.queryConditionsNSNM = '<condition expr="@namespace'+currentDb.stringConcat+'\':\''+currentDb.stringConcat+'@name = \'$KEY\'"/>';
NeoSync.queryConditions = {
	'xtk:javascript' : NeoSync.queryConditionsNSNM,
	'xtk:jst' : NeoSync.queryConditionsNSNM,
	'xtk:jssp' : NeoSync.queryConditionsNSNM,
	'xtk:sql' : NeoSync.queryConditionsNSNM,
	'xtk:workflow' : '<condition expr="@internalName = \'$KEY\'"/>',
	'xtk:form' : NeoSync.queryConditionsNSNM,
	'xtk:srcSchema' : NeoSync.queryConditionsNSNM,
	'nms:delivery' : '<condition expr="@internalName = \'$KEY\'"/>',
	'nms:includeView' : '<condition expr="@name = \'$KEY\'"/>',
	'ncm:content' : '<condition expr="@name = \'$KEY\'"/>'
};

NeoSync.onSoapQueryClientReady = function(){
	NeoSync.newFetches.forEach(function(fetch){
		var neoSync = new NeoSync({ directory : directory, fetch : fetch});
	});
};

NeoSync.prototype.processFetch = function(resolve, reject, fetch){
	//processFetch
	//console.log("Hello, processFetch(",fetch, resolve, reject,")");
	try{
		if( fetch.constructor === String)
			{
				this.nFetch = NeoSync.FetchRequest( fetch );
			}
		else
			this.nFetch = fetch;
		var querySelectorIndex = this.nFetch.schema;
		if(this.nFetch.specificKey != "")
			querySelectorIndex += "_" + this.nFetch.specificKey;

		var selector = NeoSync.querySelectors[querySelectorIndex];
		var condition = NeoSync.queryConditions[this.nFetch.schema];
		//console.log('SCHEMA : ' + this.nFetch.schema);
		/*
		switch( nFile.schema )
		{
			case 'xtk:javascript':
			case 'xtk:jst':
			case 'xtk:jssp': queryConditions = queryConditions.replace(/\$KEY/, nFile.primaryKey); break;
			case 'xtk:form': ;break;
			case 'xtk:srcSchema': ;break;
			case 'nms:delivery': ;break;
			default : query = "<xml>";
		}
		*/
		//console.log("this.nFetch.schema : " + this.nFetch)
		condition = condition.replace(/\$KEY/, this.nFetch.primaryKey);
		this.fetchQuery = '<queryDef schema="'+this.nFetch.schema+'" operation="get">'
            	+'<select>'
            	+ selector
            	+'</select>'
            	+'<where>'
            	+ condition
            	+'</where>'
            	+'</queryDef>';
        //console.log( "this.securityToken ?? ", this.securityToken );
        /*
        if(!this.soapQueryClient)
        	this.loadFetchClient( this.executeFetchQuery.bind(this, resolve, reject) );
        else
        	*/
        //console.log('I try to fetch ', fetch)
        	this.executeFetchQuery( resolve, reject );
		}
		catch(error)
		{
			console.log("processFetch error ", error, this.nFetch);
			reject( error );
		}
};
NeoSync.prototype.executeFetchQuery = function( onLoad, onError ){
	//console.log("Try to send a query", this.soapQueryClient);

	this.soapQueryClient.ExecuteQuery({sessiontoken : NeoSync.config.sessionToken,
						entity : {$xml : this.fetchQuery} }, function(onLoad, onError, err, result, raw, soapHeader) {
						//console.log(NeoSync.config.sessionToken)
						//console.log(err, result, raw, soapHeader);
						//console.log(err.response.request.headers);
						/*if( err && err.response )
						console.log('err.response.request' , err.response.request);*/
  			if(err)
  				{
  				//console.log(this.nFetch.fetchName + " --> " + err + "\n query : " + this.fetchQuery);
  				//console.log("##### MY raw : " + raw);
  				try{
	  				result = { pdomOutput : {} };
	  				//result = { pdomOutput }
			  		switch( this.nFetch.schema )
						{
						case 'xtk:javascript': result.pdomOutput.javascript = { data : raw.match(/<data><\!\[CDATA\[((?:.*\n.*)*)\]\]><\/data>/m)[1]}; break;
						case 'xtk:jst': result.pdomOutput.jst = { code : raw.match(/<data><\!\[CDATA\[((?:.*\n.*)*)\]\]><\/data>/m)[1]};; break;
						case 'xtk:jssp': result.pdomOutput.jssp = { data : raw.match(/<data><\!\[CDATA\[((?:.*\n.*)*)\]\]><\/data>/m)[1]};; break;
						case 'xtk:sql': result.pdomOutput.sql = { data : raw.match(/<data><\!\[CDATA\[((?:.*\n.*)*)\]\]><\/data>/m)[1]};; break;
						}
  					}
  				catch(e){
  					console.log(e);
  					if( onError  && NeoSync.stopOnError)
  						onError.bind(this)();
  					}
  				}

  			var resultContent = "";
  			//console.log("RAW",raw);

  			//console.log("result : ",  result.pdomOutput.delivery.content );
  			//this = nFetch (via .bind(nFetch))
  			try{
		  		switch( this.nFetch.schema )
				{
					case 'xtk:javascript': resultContent = result.pdomOutput.javascript.data; break;
					case 'xtk:jst': resultContent = result.pdomOutput.jst.code; break;
					case 'xtk:jssp': resultContent = result.pdomOutput.jssp.data; break;
					case 'xtk:sql': resultContent = result.pdomOutput.sql.data; break;
					case 'xtk:workflow': resultContent = pd.xml(raw.match(/(<workflow[\s\S]*<\/workflow>)/)[1]).replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>");break;
					case 'xtk:form': resultContent = pd.xml(raw.match(/(<form[\s\S]*<\/form>)/)[1]).replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>");break;
					case 'xtk:srcSchema': resultContent = pd.xml(raw.match(/(<srcSchema[\s\S]*<\/srcSchema>)/)[1]).replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>");break;
					case 'nms:delivery': resultContent = this.nFetch.specificKey == "html" ? result.pdomOutput.delivery.content.html.source : this.nFetch.specificKey == "txt" ? result.pdomOutput.delivery.content.text.source : pd.xml(raw.match(/(<delivery[\s\S]*<\/delivery>)/)[1]).replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>"); break;
					case 'nms:includeView': resultContent = this.nFetch.specificKey == "html" ? result.pdomOutput.includeView.source.html : this.nFetch.specificKey == "txt" ? result.pdomOutput.includeView.source.text : pd.xml(raw.match(/(<includeView[\s\S]*<\/includeView>)/)[1]).replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>"); break;
					case 'ncm:content': realSchema = result.pdomOutput.content.attributes['publishing-name']; resultContent = pd.xml(raw.match(/(<content[\s\S]*<\/content>)/)[1]).replace(/^<content([\s\S]*)<\/content>$/,"<"+realSchema+"$1</"+realSchema+">").replace(/\n\s*<!\[CDATA/g,"<![CDATA").replace(/\]\]>\n\s*/g,"]]>"); break;

				}
				NeoSync.createFetchedFile( this.nFetch, resultContent );
			}
			catch( error ){
				console.log("ERROR FOR " + this.fetchQuery + ": " + error );
				//console.log("__--**--__ ERROR with onError ? " , onError)
				if( onError && NeoSync.stopOnError)
  					{
					//console.log("__--**--__ I TRY onERROR() " , onError)
  						onError( error );
  					}
			}
			if(this.onFetchDone && typeof this.onFetchDone == "function")
				this.onFetchDone();
			//console.log("executeFetchQuery onload : " + onLoad);
			if(onLoad)
				onLoad();

	  	}.bind(this, onLoad, onError));
};





NeoSync.createFetchedFile = function (nFetch, content){
	var fileName = nFetch.primaryKey.replace(/:/,'_');
	if( nFetch.fileSuffix )
		fileName += "_" + nFetch.fileSuffix;
	switch( nFetch.schema )
			{
				case 'xtk:javascript': fileName+=''; break;
				case 'xtk:jst': fileName+='.jst'; break;
				case 'xtk:jssp': fileName+=''; break;
				case 'xtk:sql': fileName+='.sql'; break;
				case 'nms:delivery': fileName += nFetch.specificKey == "html" ? '.html' : nFetch.specificKey == "txt" ? '.txt' : '.xml';
				 break;
				case 'nms:includeView': fileName += nFetch.specificKey == "html" ? '.iview.html' : nFetch.specificKey == "txt" ? '.iview.txt' : '.xml';
				 break;
				default : fileName+='.xml';;
			}
	//console.log(content);
	fs.writeFileSync(nFetch.directory + path.sep + fileName, content);

	console.log(nFetch.directory + path.sep + fileName + " ecrit sur le disque");
};
NeoSync.FetchRequest = function( fetchPath ){
	var fetchNameReg = "\\" + path.sep + "([^\\" + path.sep + "]*$)";
	var fetchName = "";
	var fetchDirReg = "(.*)\\" + path.sep + "[^\\" + path.sep + "]*$";
	var fetchDir = "";
	var schemaPkReg = "([^\=]*)=(.*)";
	var schemaName = "";
	var primaryKey = "";
	var specificKeyReg = "([^\\[]*)\\[([^\\]]*)\\]$";
	var specificKey = "";
	if( fetchPath.match(fetchNameReg) && fetchPath.match(fetchNameReg).length > 1 )
		fetchName = fetchPath.match(fetchNameReg)[1];
	else
		fetchName = fetchPath;
	if( fetchPath.match(fetchDirReg) && fetchPath.match(fetchDirReg).length > 1 )
		fetchDir = fetchPath.match(fetchDirReg)[1];
	if( fetchName.match(schemaPkReg) && fetchName.match(schemaPkReg).length > 2 )
		{
			schemaName = fetchName.match(schemaPkReg)[1];
			primaryKey = fetchName.match(schemaPkReg)[2];
			testPK = primaryKey;
			if( testPK.match( specificKeyReg ) && testPK.match( specificKeyReg ).length > 2 )
				{
					primaryKey = testPK.match( specificKeyReg )[1];
					specificKey = testPK.match( specificKeyReg )[2];
				}
		}
	return {
		fetchName : fetchName,
		schema : schemaName,
		primaryKey : primaryKey,
		specificKey : specificKey,
		directory:fetchDir
	};
};

NeoSync.getFetchFromFile = function( fileName ){
	var nFile = NeoSync.File( fileName );
	var pk = "", schema = "", specificKey = "";
	if( nFile.extension == "xml" )
		{
			var fileR = fs.readFileSync( fileName );
			if( fileR.toString().match(/xtkschema="([^"]*)"/) && fileR.toString().match(/xtkschema="([^"]*)"/).length > 1 )
				schema = fileR.toString().match(/xtkschema="([^"]*)"/)[1];
		}
	else if( nFile.extension == "js" )
		schema = 'xtk:javascript';
	else if( nFile.extension == "jst" )
		schema = 'xtk:jst';
	else if( nFile.extension == "jssp" )
		schema = 'xtk:jssp';
	else if( nFile.extension == "sql" )
		schema = 'xtk:sql';
	else if( nFile.extension == "iview.txt" || nFile.extension == "iview.html")
		schema = 'nms:includeView';
	else if( nFile.extension == "txt" || nFile.extension == "html")
		schema = 'nms:delivery';

	switch(schema)
		{
		case 'xtk:form' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'xtk:srcSchema' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'ncm:content' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'xtk:javascript' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'xtk:jst' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'xtk:jssp' : pk = nFile.internalName.replace(/_/,':'); break;
		case 'xtk:sql' : pk = nFile.internalName.replace(/_/,':'); break;
		default : pk = nFile.internalName;
		}

	if( nFile.extension == "js" || nFile.extension == "jssp" || nFile.extension == "sql")
		specificKey += "." + nFile.extension;

	if( nFile.extension == "iview.txt" || nFile.extension == "txt")
		specificKey += '[txt]';
	else if( nFile.extension == "iview.html" || nFile.extension == "html")
		specificKey += '[html]';

	return schema + "=" + pk + specificKey;
};
NeoSync.prototype.kill = function(){
	//console.log("Buwaaaa I die");
	this.watcher.close();
};
NeoSync.prototype.backup = function( fetch ){
	//var backupNS = new NeoSync();
	var nFetch = NeoSync.FetchRequest( fetch );
	var backupDir = getUserHome() + path.sep + 'NeoSync'+ path.sep + 'BACKUP' ;
	nFetch.directory = backupDir;
	var now = new Date();
	nFetch.fileSuffix = dateFormat(now, "dd_mm_yyyy-hhMMss");
	//backupNS.name = "backupNS";
	//backupNS.processFetch( nFetch );
	//backupNS.pushAction( function(){console.log("ET MERDE !!! ")}, false, "HAHA" );
	this.pushAction( this.processFetch, false, nFetch );
};

/*
 * watcher
	  .on('add', function(path) { console.log('File', path, 'has been added'); })
	  .on('addDir', function(path) { console.log('Directory', path, 'has been added'); })
	  .on('change', function(path) { console.log('File', path, 'has been changed'); })
	  .on('unlink', function(path) { console.log('File', path, 'has been removed'); })
	  .on('unlinkDir', function(path) { console.log('Directory', path, 'has been removed'); })
	  .on('error', function(error) { console.log('Error happened', error); })
	  .on('ready', function() { console.log('Initial scan complete. Ready for changes.'); })
	  .on('raw', function(event, path, details) { console.log('Raw event info:', event, path, details); });

 */
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

exports.NeoSync = NeoSync;