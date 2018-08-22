DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS issueposts;
DROP TABLE IF EXISTS issuetags;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    fullname VARCHAR(100) NOT NULL,
    isadministrator BOOLEAN DEFAULT FALSE,
    passwordhash CHAR(128) NOT NULL,
    passwordsalt INT NOT NULL,
    apikey CHAR(128) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    projectname VARCHAR(100) NOT NULL,
    shortprojectid VARCHAR(3) NOT NULL UNIQUE,
    authorid INT NOT NULL,
    FOREIGN KEY (authorid) REFERENCES users(id)  
);
CREATE TABLE IF NOT EXISTS issues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    issuename VARCHAR(100) NOT NULL,
    authorid INT,
    FOREIGN KEY (authorid) REFERENCES users(id),
    projectid INT NOT NULL,
    FOREIGN KEY (projectid) REFERENCES projects(id),
    isclosed BOOLEAN DEFAULT FALSE,
    assigneeid INT,
    FOREIGN KEY (assigneeid) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS issueposts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    authorid INT NOT NULL,
    issueid INT NOT NULL,
    FOREIGN KEY (authorid) REFERENCES users(id),
    FOREIGN KEY (issueid) REFERENCES issues(id),
    containedtext TEXT NOT NULL,
    dateofcreation DATETIME NOT NULL,
    dateofedit DATETIME
);
CREATE TABLE IF NOT EXISTS issuetags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    Issueid INT NOT NULL,
    FOREIGN KEY (Issueid) REFERENCES issues(id),
    TagText VARCHAR(64) NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) NOT NULL PRIMARY KEY,
    expires INT(11) UNSIGNED NOT NULL,
    data TEXT 
);