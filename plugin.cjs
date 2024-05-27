// @ts-check

/*
Plugin that automatically runs selected binaries from the root, even
when running inside of an individual package. This is so that such
packages don't have to be added as depenendencies everywhere.
*/

const fs = require("node:fs");
const path = require("node:path");

const npmBinsToPackageName = {
  "cross-env": "cross-env",
  jest: "jest-cli",
  "ts-node": "ts-node",
  vite: "vite",
  biome: "@biomejs/biome",
  nest: "@nestjs/cli",
  webpack: "webpack",
  tsc: "typescript",
  "build-storybook":
    "../build/webpack/storybook6_5/node_modules/@storybook/react",
  "start-storybook":
    "../build/webpack/storybook6_5/node_modules/@storybook/react",
};

const nodeFlags = {
  "build-storybook": ["--max-old-space-size=16384"],
  "start-storybook": ["--max-old-space-size=16384"],
};

const paths = [];
for (const k of Object.keys(npmBinsToPackageName)) {
  paths.push([k], ["run", k]);
}

module.exports = {
  name: "monorepo-tools",
  factory: (require) => {
    const { BaseCommand } = require("@yarnpkg/cli");
    const { Option } = require("clipanion");

    class ExecuteBinFromRootCommand extends BaseCommand {
      static paths = paths;

      args = Option.Proxy();

      async execute() {


        const ownPackageJson = JSON.parse(
          await fs.promises.readFile("package.json", "utf-8")
        );
        const cmd = this.path[this.path.length - 1];

        if (ownPackageJson.scripts?.[cmd]) {
          throw new Error(
            `'${cmd}' is defined in package.json but the 'monorepo-tools' also defined it. To avoid unexpected results, please rename the script in package.json`
          );
        }

        const dir = await this.getBinaryPackageDirectory(
          fs,
          path,
          cmd,
          ownPackageJson
        );
        const pkg = JSON.parse(
          await fs.promises.readFile(path.join(dir, "package.json"), "utf-8")
        );

        const packageRelativeBinPath =
          typeof pkg.bin === "object" ? pkg.bin[cmd] : pkg.bin;

        const binPath = path.join(dir, packageRelativeBinPath);

        process.exitCode = await this.cli.run([
          "node",
          ...(nodeFlags[cmd] || []),
          binPath,
          ...this.args,
        ]);

        // seems something in yarn resets the exit code, so force exit
        process.exit();
      }

      async getBinaryPackageDirectory(fs, path, cmd, ownPackageJson) {
        return path.resolve(
          __dirname,
          "./node_modules",
          npmBinsToPackageName[cmd]
        );
      }
    }

    return {
      commands: [ExecuteBinFromRootCommand],
    };
  },
};
