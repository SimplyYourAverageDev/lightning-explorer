export namespace backend {
	
	export class FileInfo {
	    name: string;
	    path: string;
	    isDir: boolean;
	    size: number;
	    modTime: string;
	    permissions: string;
	    extension: string;
	    isHidden: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.modTime = source["modTime"];
	        this.permissions = source["permissions"];
	        this.extension = source["extension"];
	        this.isHidden = source["isHidden"];
	    }
	}
	export class DirectoryContents {
	    currentPath: string;
	    parentPath: string;
	    files: FileInfo[];
	    directories: FileInfo[];
	    totalFiles: number;
	    totalDirs: number;
	
	    static createFrom(source: any = {}) {
	        return new DirectoryContents(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentPath = source["currentPath"];
	        this.parentPath = source["parentPath"];
	        this.files = this.convertValues(source["files"], FileInfo);
	        this.directories = this.convertValues(source["directories"], FileInfo);
	        this.totalFiles = source["totalFiles"];
	        this.totalDirs = source["totalDirs"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DriveInfo {
	    path: string;
	    letter: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new DriveInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.letter = source["letter"];
	        this.name = source["name"];
	    }
	}
	
	export class NavigationResponse {
	    success: boolean;
	    message: string;
	    data: DirectoryContents;
	
	    static createFrom(source: any = {}) {
	        return new NavigationResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message = source["message"];
	        this.data = this.convertValues(source["data"], DirectoryContents);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

