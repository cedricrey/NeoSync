# NeoSync

CLI Synchronisation utility between local files and Neolane / Adobe Campaign
Utilitaire en ligne de commande de synchronisation entre fichier locaux et Neolane

## Getting Started

First of all, just know that nodejs utility has been built with quick and dirty development. It wasn't expected to be shared. If interested, be  guest, but :
1) the code is horrible and crapy
2) not a very good experience of project distribution and repository, so the package.json and other things are very incomplet

First copy the NeoSync Folder from 'To_User_Folder' inot your user folder (~/ in Unix like OS, c:\Users\yourname or something like that).
Then, configure the neoSync.conf file with server url, name and password (ok, it sucks but IE password used by the Neolane Console are not readable. If you have a better idea, let me know) => new features for multi config to come

### Prerequisites

having Nodejs >= 0.12 installed

```
Give examples
```

### Installing

On windows, just run install_win.cmd to add this folder to your PATH. It used to work, but the last time I had to do it manually...
This is in order to launch "NeoSync" command from any folder

I forgot how I did on my mac, it's been long time... I think I did it manually ?
So anyway, be sure that the source folder is in your Path, that's all.


### Use

Main command is 
```
NeoSync -[w,f,p,pa] options
```




## Authors

* **Cédric Rey** - *Initial work* - [cedricrey](https://github.com/cedricrey)


## License

This project is licensed under ... I don't know yet. I think this is so dirty that no one want it



