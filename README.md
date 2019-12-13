# NeoSync

## Goobye NeoSync
:new: NeoSync is becoming the fresh new **[ACSync](https://www.npmjs.com/package/ac-sync)** ! Please, see more on [GitHub](https://github.com/cedricrey/ac-sync) and [npmjs](https://www.npmjs.com/package/ac-sync)


# What was NeoSync (you can still use it)

CLI Synchronisation utility between local files and Neolane / Adobe Campaign

In French :

Utilitaire en ligne de commande de synchronisation entre fichier locaux et Neolane

## Before starting

First of all, just keep in mind that this nodejs utility has been built with quick and dirty development. It wasn't expected to be shared. If interested, be my guest, but :
1) the code is horrible and crapy
2) not a very good experience of project distribution and repository, so the package.json and other things are very incomplete

I did some change recently, so it should not be stable. I work with Promises instead of making pyramid of doom, the code is a little more readable now.

## Getting Started

First copy the NeoSync Folder from 'To_User_Folder' inot your user folder (~/ in Unix like OS, c:\Users\yourname or something like that).
Then, configure the neoSync.conf file with server url, name and password (ok, it sucks but IE password used by the Neolane Console are not readable. If you have a better idea, let me know) => new features for multi config to come

### Prerequisites

having Nodejs >= 0.12 installed


### Installing

On windows, just run install_win.cmd to add this folder to your PATH. It used to work, but the last time I had to do it manually...
This is in order to launch "NeoSync" command from any folder

I forgot how I did on my mac, it's been long time... I think I did it manually ?
So anyway, be sure that the source folder is in your Path, that's all.


## Use

Main command is 
```
NeoSync -[w,f,p,pa] options
```

### Fetch source
```
NeoSync -f namespace:schema=logicKey[;namespace:schema=logicKey]
NeoSync -fetch namespace:schema=logicKey[;namespace:schema=logicKey]
```

Getting the deliveries with internalName 'TOTO' and 'TATA' :
```
NeoSync -f nms:delivery=TOTO;nms:delivery=TATA
```
This command will create the TOTO.xml and TATA.xml files on the current local directory

Avaiblale fetch :

| Fetch | Key | Result |
| -------------: |:---------------- | :----- |
| xtk:javascript | ns:name  |  ns_name.js file (src file) |
| xtk:jst | ns:name  |  ns_name.jst file |
| xtk:jssp | ns:name  |  ns_name.jssp file |
| xtk:workflow | internalName  |  internalName.xml file (the wofklow as XML) |
| xtk:form | ns:name  |  ns_name.xml file | |
| xtk:srcSchema | ns:name  |  ns_name.xml file |
| nms:delivery | internalName  |  internalName.xml file |
| nms:includeView | internalName  |  internalName.xml file |
| ncm:content | internalName  |  internalName.xml file |
| nms:delivery | internalName[html]  |  internalName.html file containing only the html source of the delivery |
| nms:delivery | internalName[txt]  |  internalName.txt file containing only the text source of the delivery |
| nms:includeView | internalName[html]  |  internalName.iview.html file containing only the html source of the include view |
| nms:includeView | internalName[txt]  |  internalName.iview.txt file containing only the text source of the include view |

### Push source to the server
```
NeoSync -p localfilename
NeoSync -push localfilename
```
NeoSync wil recognize what to do with :
 - the extension of the file
 - the content of the file in case of XML file
```
NeoSync -p TOTO.html
```
This command will push the HTML source of the delivery with 'TOTO' as internal name.

Attention please : if the parameter 'devMode' is set to 0 or undefined in the neoSync.conf of the user, only HTML and Text version of deliveries and includes views can be pushed to the server.
Other source will be ignored. This is a security if non developpers want to work with NeoSync (HTML integration, Marketing people etc.).
Also, if a push is done, NeoSync will make a backup of the current server source before pushing. The backup is in the "NeoSync/BACKUP" folder into the user folder (next to neoSync.conf)

### Push all source to the server
```
NeoSync -pa
NeoSync -pushall
```
Same as before, but for all the file into the current folder

### Watch the current folder and push when change detected
```
NeoSync -w
NeoSync -watch
```
NeoSync will push a file when a change is detected.
You can :
- change the directory with the '-d path/to/watch' option if you don't want watch the current directory
- specify a pattern for the files to push with '-pattern yourpattern'. For example, if you want to push only Javascript, NeoSync -w -pattern *.js`

## Authors

* **Cédric Rey** - *Initial work* - [cedricrey](https://github.com/cedricrey)