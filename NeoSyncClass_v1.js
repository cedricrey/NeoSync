var fs = require('fs'),
	https = require('https'),
	http = require('http'),
	path = require('path'),
	chokidar = require('chokidar'),
	querystring = require('querystring'),
	soap = require('soap'),
	pd = require('pretty-data').pd,
	dateFormat = require('dateformat'),
	FormData = require('form-data');

//console.log('Current exec dir : ' + __dirname);
//console.log('Current dir : ' + process.cwd());
function NeoSync( options ){
	options = options || {};
	if(!NeoSync.config)
		NeoSync.initConfiguration();
	this.directory = options.directory || process.cwd();
	this.watching = options.watch || false;
	this.pushAll = options.pushAll || false;
	this.filePattern = options.filePattern || false;
	this.fetch = options.fetch || "";
	this.onFileRefresh = options.onFileRefresh || null;
	this.onFetchDone = options.onFetchDone || null;
	this.watchInPause = false;

	console.log("NeoSync init : " + this.directory);
	if(options.push)
		{
			this.changeTriggered( options.push );
			return this;
		}
	if( this.fetch != "")
		{
			this.processFetch( this.fetch );
			return this; //fin du traitement
		}
	var pattern = "";
	if(this.filePattern)
		pattern = path.sep + this.filePattern;

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

	 return this;
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
		NeoSync.backup( NeoSync.getFetchFromFile( filePath ) );
	}
	catch( e ){
			console.log( "NeoSync : echec de sauvegarde " + nFile.fileName );
	}
	this.soapWriterClient.Write({sessiontoken : NeoSync.config.sessionToken,
								domDoc : {$xml : contentToSend} }, function(err, result, raw, soapHeader) {
	      		if(err)
	      			console.log(err);
	      		if(typeof this.onFileRefresh == "function")
	      			this.onFileRefresh( {nFile : nFile, result : result, error : err} );
			  }.bind(this));

};

NeoSync.getXMLSourceFile = function( neoFile, content){
	var xml;

	switch( neoFile.extension )
	{
		case 'js': xml = "<javascript xtkschema='xtk:javascript' name='"+ neoFile.xmlName +".js' namespace='"+ neoFile.nameSpace +"' ><data><![CDATA[$CONTENT]]></data></javascript>";break;
		case 'jst': xml = "<jst xtkschema='xtk:jst' name='"+ neoFile.xmlName +"' namespace='"+ neoFile.nameSpace +"' ><code><![CDATA[$CONTENT]]></code></jst>";break;
		case 'jssp': xml = "<jssp xtkschema='xtk:jssp' name='"+ neoFile.xmlName +".jssp' namespace='"+ neoFile.nameSpace +"' ><data><![CDATA[$CONTENT]]></data></jssp>";break;
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
NeoSync.processArguments = function(){
	for(var i in process.argv)
		{
			if(process.argv[i] == '-d' && process.argv.length > i)
				NeoSync.directories = NeoSync.processDirectories( process.argv[ (parseInt(i)+1) ] );
			if(['-f','-fetch'].indexOf( process.argv[i].toLowerCase() ) == 0 && process.argv.length > i)
				NeoSync.newFetches = NeoSync.processFetches( process.argv[ (parseInt(i)+1) ] );
			if(['-w','-watch'].indexOf( process.argv[i].toLowerCase() ) == 0)
				NeoSync.watching = true;
			if(['-pa','-pushall'].indexOf( process.argv[i].toLowerCase() ) == 0)
				NeoSync.pushAll = true;
			if(['-pattern'].indexOf( process.argv[i].toLowerCase() ) == 0 && process.argv.length > i)
				NeoSync.filePattern = process.argv[ (parseInt(i)+1) ];
			if(['-p','-push'].indexOf( process.argv[i].toLowerCase() ) == 0 && process.argv.length > i)
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
NeoSync.devServer = ['http://neo2indus-dev:8080',
					'https://neo2indus-dev:8080',
					'http://neo2indus-dev:8080/',
					'https://neo2indus-dev:8080/',];
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
	if(NeoSync.devServer.indexOf(NeoSync.config.server) != -1 || NeoSync.config.devMode == 1)
		NeoSync.config.mode = 'dev';
	/*
	soap.createClient(NeoSync.config.xtkSessionWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp"},function(err, client) {
			NeoSync.soapWriterClient = client;
			console.log("NeoSync Soap Client Ready");
			//console.log(NeoSync);
			NeoSync.onSoapClientReady();
	  });*/

	/*
	soap.createClient(NeoSync.config.xtkQueryDefWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp"},function(err, client) {
			NeoSync.soapQueryClient = client;
			console.log("NeoSync Soap Client Ready");
			//console.log(NeoSync);
			NeoSync.onSoapQueryClientReady();
	  });
	  */
	console.log("Hello " + NeoSync.config.userName);
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

	NeoSync.directories.forEach(function(directory){
		var neoSync = new NeoSync({ directory : directory, watch : NeoSync.watching, pushAll : NeoSync.pushAll, filePattern : NeoSync.filePattern });
	});
	NeoSync.newFetches.forEach(function(fetch){
		var neoSync = new NeoSync({ fetch : fetch});
	});

};

NeoSync.prototype.loadWriteClient = function( onLoaded ){
	//this.onloadedWriteClient = onLoaded;
	soap.createClient(NeoSync.config.xtkSessionWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp"},function(onLoaded, err, client) {
		this.soapWriterClient = client;
		//console.log("NeoSync Soap Client Ready");
		//console.log(NeoSync);
		onLoaded();
  	}.bind(this, onLoaded));
};

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
	'xtk:workflow' : '<node expr="data"/><node expr="@label"/><node expr="@internalName"/><node expr="@isModel"/><node expr="[/]"/><node expr="@showSQL"/><node expr="@keepResult"/><node expr="@schema"/><node expr="@recipientLink"/><node anyType="true" expr="script"/><node expr="@builtIn"/><node expr="@modelName"/><node expr="@form"/><node anyType="true" expr="variables"/>',
	'xtk:form' : '<node expr="data"/><node expr="@xtkschema"/>',
	'xtk:srcSchema' : '<node expr="data"/><node expr="@xtkschema"/>',
	'nms:delivery' : '<node expr="data"/><node expr="@internalName"/><node expr="@isModel"/><node expr="@deliveryMode"/><node expr="@label"/><node expr="[folder/@name]"/><node expr="[folderProcess/@name]"/><node expr="[mapping/@name]"/><node expr="[typology/@name]"/><node expr="[operation/@internalName]"/><node expr="[deliveryProvider/@name]"/><node expr="@xtkschema"/>',
	'nms:delivery_html' : '<node expr="[content/html/source]"/>',
	'nms:delivery_txt' : '<node expr="[content/text/source]"/>',
	'nms:includeView' : '<node expr="data"/><node expr="@name"/><node expr="@label"/><node expr="[folder/@name]"/><node expr="\'nms:includeView\'" alias="@xtkschema"/>',
	'nms:includeView_html' : '<node expr="[source/html]"/>',
	'nms:includeView_txt' : '<node expr="[source/text]"/>',
	'ncm:content' : '<node expr="data"/><node expr="@xtkschema"/><node expr="@editForm"/><node expr="@name"/><node expr="@label"/><node expr="[@publishing-name]"/><node expr="[@publishing-namespace]"/><node expr="[channel/@name]"/>'
};
NeoSync.queryConditions = {
	'xtk:javascript' : '<condition expr="@namespace||\':\'||@name = \'$KEY\'"/>',
	'xtk:jst' : '<condition expr="@namespace||\':\'||@name = \'$KEY\'"/>',
	'xtk:jssp' : '<condition expr="@namespace||\':\'||@name = \'$KEY\'"/>',
	'xtk:workflow' : '<condition expr="@internalName = \'$KEY\'"/>',
	'xtk:form' : '<condition expr="@namespace||\':\'||@name = \'$KEY\'"/>',
	'xtk:srcSchema' : '<condition expr="@namespace||\':\'||@name = \'$KEY\'"/>',
	'nms:delivery' : '<condition expr="@internalName = \'$KEY\'"/>',
	'nms:includeView' : '<condition expr="@name = \'$KEY\'"/>',
	'ncm:content' : '<condition expr="@name = \'$KEY\'"/>'
};

NeoSync.onSoapQueryClientReady = function(){
	NeoSync.newFetches.forEach(function(fetch){
		var neoSync = new NeoSync({ directory : directory, fetch : fetch});
	});
};

NeoSync.prototype.processFetch = function( fetch ){
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
		console.log("this.nFetch.schema : " + this.nFetch.schema)
		condition = condition.replace(/\$KEY/, this.nFetch.primaryKey);
		this.fetchQuery = '<queryDef schema="'+this.nFetch.schema+'" operation="get">'
            	+'<select>'
            	+ selector
            	+'</select>'
            	+'<where>'
            	+ condition
            	+'</where>'
            	+'</queryDef>';
        //console.log( this.fetchQuery );
        if(!this.soapQueryClient)
        	this.loadFetchClient( this.executeFetchQuery );
        else
        	this.executeFetchQuery();

};
NeoSync.prototype.executeFetchQuery = function(){
	this.soapQueryClient.ExecuteQuery({sessiontoken : NeoSync.config.sessionToken,
						entity : {$xml : this.fetchQuery} }, function(err, result, raw, soapHeader) {
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
						}
  					}
  				catch(e){
  					console.log(e);
  					}
  				}

  			var resultContent = "";
  			//this = nFetch (via .bind(nFetch))
  			try{
		  		switch( this.nFetch.schema )
				{
					case 'xtk:javascript': resultContent = result.pdomOutput.javascript.data; break;
					case 'xtk:jst': resultContent = result.pdomOutput.jst.code; break;
					case 'xtk:jssp': resultContent = result.pdomOutput.jssp.data; break;
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
			}
			if(this.onFetchDone && typeof this.onFetchDone == "function")
				this.onFetchDone();
	  	}.bind(this));
};
NeoSync.prototype.loadFetchClient = function( onLoaded ){
	this.onloadedFetchClient = onLoaded;
	soap.createClient(NeoSync.config.xtkQueryDefWSDL, {endpoint : NeoSync.config.server + "/nl/jsp/soaprouter.jsp"},function(err, client) {
			this.soapQueryClient = client;
			console.log("NeoSync Soap Client Ready");
			//console.log(NeoSync);
			this.onloadedFetchClient();
	  }.bind(this));

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
		default : pk = nFile.internalName;
		}

	if( nFile.extension == "js" || nFile.extension == "jssp")
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
NeoSync.backup = function( fetch ){
	var backupNS = new NeoSync();
	var nFetch = NeoSync.FetchRequest( fetch );
	var backupDir = getUserHome() + path.sep + 'NeoSync'+ path.sep + 'BACKUP' ;
	nFetch.directory = backupDir;
	var now = new Date();
	nFetch.fileSuffix = dateFormat(now, "dd_mm_yyyy-hhMMss");
	backupNS.processFetch( nFetch );
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
