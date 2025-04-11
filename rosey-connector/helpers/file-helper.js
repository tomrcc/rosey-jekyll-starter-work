import fs from "fs";
import YAML from "yaml";

async function readFileWithFallback(filepath, fallbackString) {
  try {
    const buffer = await fs.promises.readFile(filepath);
    return buffer.toString("utf-8") || fallbackString;
  } catch (err) {
    if (err.code === "ENOENT") {
      return fallbackString;
    }
    throw err;
  }
}

async function readJsonFromFile(filepath) {
  const contents = await readFileWithFallback(filepath, "{}");
  return JSON.parse(contents);
}

async function isDirectory(filepath) {
  const stat = await fs.promises.stat(filepath);

  return stat.isDirectory();
}

async function readContentPage(filePath) {
  if (!filePath) {
    console.log("No filepath provided");
    return;
  }
  const buffer = await fs.promises.readFile(filePath);
  const fileData = buffer.toString("utf-8");
  const [emptySpace, frontmatter, ...restOfPage] = fileData.split("---");
  const fileDataFrontMatterString = frontmatter;
  // Allow for <hr> in body content which is represented by '---' in markdown and ruins our split
  const fileDataBodyContent =
    restOfPage.length === 1 ? restOfPage[0] : restOfPage.join("---");
  const fileFrontMatter = YAML.parse(fileDataFrontMatterString);

  return {
    frontmatter: fileFrontMatter,
    bodyContent: fileDataBodyContent,
  };
}

async function readConfigFile(configFilePath) {
  const buffer = await fs.promises.readFile(configFilePath);
  const fileData = buffer.toString("utf-8");
  const configData = YAML.parse(fileData);
  return configData;
}

function getTranslationHtmlFilename(translationFilename, baseUrlFileData) {
  if (translationFilename === "404.yaml") {
    return "404.html";
  }

  if (translationFilename === "home.yaml") {
    return "index.html";
  }

  const htmlFileName = translationFilename.replace(".yaml", "/index.html");
  const extensionlessHtmlFileName = translationFilename.replace(
    ".yaml",
    ".html"
  );

  const baseUrlFileDataKeys = Object.keys(baseUrlFileData);
  // Check whether the filename is filename.html or filename/index.html
  const fileName = baseUrlFileDataKeys.includes(htmlFileName)
    ? htmlFileName
    : extensionlessHtmlFileName;

  if (!fileName) {
    console.log("No filename found in our base.urls.json");
  }

  return fileName;
}

function getYamlFileName(file) {
  if (!file) {
    return "";
  }
  return file
    .replace("/index.html", "")
    .replace(".html", "")
    .replace("index", "home");
}

function getParentFolderName(filePath) {
  if (!filePath) {
    return "";
  }

  return filePath.substring(0, filePath.lastIndexOf("/") + 1);
}

export {
  readFileWithFallback,
  readJsonFromFile,
  isDirectory,
  readContentPage,
  readConfigFile,
  getTranslationHtmlFilename,
  getYamlFileName,
  getParentFolderName,
};
