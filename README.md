# Rosey Jekyll Starter

This is a good starting point for a developer looking to build a translation workflow for non-technical editors using CloudCannon's CMS.

Rosey is used to generate a multilingual site, complete with browser settings detection with a redirect to the site visitor's default language. 

To generate the multilingual site:

  1. Html elements are tagged for translation.

  2. Rosey creates a JSON file from these tags by scanning your built static site.

  3. Rosey takes a different `locales/xx-XX.json` file, which contains the original phrase with a user entered translation and generates the finished translated site.

What the RCC connector does is create a way for non-technical editors to create these `locales/xx-XX.json` files needed to generate the site. YAML files are generated with the correct configuration to enable translations via an interface in CloudCannon's CMS, rather than writing JSON by hand. All of this happens in your site's postbuild, meaning it automatically happens each build. The file generation happens on your staging site, while the multilingual site generation takes place on your production (main) site.

## Requirements

- A CloudCannon organisation with access to [publishing workflows](https://cloudcannon.com)
- A static site

## Why is this useful?

A traditional easier-to-understand approach would be to maintain separate copies of each page for each language. This would mean creating a directory for each language, with content pages for each. This is sometimes referred to as split-by-directory. While it is easy to understand, and debug, it can become tedious to have to replicate any non-text changes across all the separate copies of your languages.

This approach has you maintain one copy of a page. Inputs are generated for all the text content that is tagged for translation, meaning editors can focus on providing just the translations instead of replicating all changes made to a page. It basically separates your content and your layouts - a concept well established in the SSG (and CMS) world. You can change the layout and styling in one place, and have those changes reflected across all the languages you translate to.

## Getting started

1. Make a copy of this repo on your own GitHub, by clicking `Use as template`.

2. Create a new branch on this repo called `staging`.

3. Create a site each for both branches on CloudCannon.

4. Add `main` as the publishing branch for the `staging` site.

5. To your staging site:

    a. Add the env variable `SYNC_PATHS`, with the value `/rosey/`.

    b. If you have a Smartling account set up for automatic translations, add the env variable `DEV_USER_SECRET`. Add your Smartling API key as the value of `DEV_USER_SECRET`.

6. To your production site, add the env variable `ROSEYPROD` with a value of `true`.

7. In your `rosey/config.yml` change the language code in the `locales` array to one that you want, and add your staging cloudvent url to the `base_url` key.

8. To add automatic AI-powered translations - which your editors can then QA - enable Smartling in your `rosey/config.yaml` file, by setting `smartling_enabled: true`. Make sure to fill in your `dev_project_id`, and `dev_user_identifier`, with the credentials in your Smartling account. Ensure you have added you secret API key to your environment variables in CloudCannon, as `DEV_USER_SECRET`. You can set this locally in a `.env` file if you want to test it in your development environment. 

    > [!IMPORTANT]
    > Make sure to not push any secret API keys to your source control. The `.env` file should already be in your .gitignore.

    > [!IMPORTANT]
    > **Be aware these translations have some cost involved**, so make sure you understand the pricing around Smartling machine-translations before enabling this. 

## Generating ids

When tagging content for translation, the slugified contents of that translation should be used as the `data-rosey` id.

An example in Jekyll:

```liquid
<h1 class="{{c}}__title" data-rosey="{{ include.title | slugify }}">{{ include.title }}</h1>
```

The built in `slugify` filter makes it easy to slugify the text contents for use as the `data-rosey` tag. Templating with the `markdownify` filter does not need tagged like this, as it will automatically be tagged with plugins.

## Markdown processing

A prebuild exists in your `.cloudcannon` folder.

``` bash
#!/usr/bin/env bash

echo "Moving jekyllMarkdownPlugin.rb to _plugins"
mv rosey-connector/ssgs/jekyllMarkdownPlugin.rb site/_plugins/jekyllMarkdownPlugin.rb
echo "Moved jekyllMarkdownPlugin.rb to _plugins!"
echo "Moving jekyllImagePlugin.rb to _plugins"
mv rosey-connector/ssgs/jekyllImagePlugin.rb site/_plugins/jekyllImagePlugin.rb
echo "Moved jekyllImagePlugin.rb to _plugins!"
```

This prebuild moves two plugins two our sites `_plugins` folder. Both plugins customise the markdown processing of Jekyll; by extending how Jekyll uses Kramdown to parse the markdown. This affects page body content, and templating with the `markdownify` filter. This means neither body content, nor templating with the `markdownify` filter need to be tagged manually.

`jekyllMarkdownPlugin.rb` tags all block level elements with `data-rosey` tags. It uses the slugified text contents of the element for the value.

`jekyllImagePlugin.rb` removes the wrapping paragraph element from an image. This is important so that we don't have image links mistakenly appear in our translations.

> [!IMPORTANT]
> You could remove this, and place it permanently in your `_plugins` directory. This is moved on this template because the rosey-connector directory depends on an upstream repository for maintenance. Your project will likely have no such need.

## Build directory
Your postbuild should use `_site` as it's source.

```bash
#!/usr/bin/env bash
npx @bookshop/generate

if [[ $ROSEYPROD != "true" ]];
then
  npx rosey generate --source _site
  node rosey-connector/roseyCloudCannonConnector.js
fi

if [[ $ROSEYPROD == "true" ]];
then
  echo "Translating site with Rosey"
  # By default, Rosey will place the default language under a language code, e.g. /en/index.html, and will generate a redirect file at /index.html.
  # By setting the flag --default-language-at-root, Rosey will output the default language at the root path, e.g. /index.html.
  # By setting the flag --default-language-at-root, Rosey will not generate any redirect pages.

  # We only want this to run on our production site, as it can interfere with CloudCannon CMS's visual editor
  # There's a little bit of shuffling around here to ensure the translated site ends up where CloudCannon picks up your site
  mv ./_site ./untranslated_site                  
  npx rosey build --source untranslated_site --dest _site 
fi
```

## Local Development
Install the dependencies for Bookshop:

~~~bash
$ npm install
~~~

Install the Jekyll dependencies with [Bundler](http://bundler.io/):

~~~bash
$ npm run jekyll:install
~~~

Run the website:

~~~bash
$ npm start
~~~


> [!IMPORTANT]
> When running locally, and on staging, translations will not work. Rosey runs on your production site so translations will appear there. 


> [!IMPORTANT]
> When running locally, the pagination will not work. Deploy to CloudCannon to see successful pagination. 


## Maintaining this repo

The directory `rosey-connector` is being updated from an [upstream repository](https://github.com/CloudCannon/rcc?tab=readme-ov-file#adding-the-rosey-connector-to-downstream-repositories). Make any changes to this directory upstream.
