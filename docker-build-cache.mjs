import { $ } from "zx";

const AWS_REPO_URL = process.env.AWS_ECR_REPO_URL;
const AWS_REPO_NAME = process.env.AWS_ECR_REPO_NAME;

export async function dockerBuildCache() {
  const gitHashMain = await $`git rev-parse --short=8 origin/main`;
  const gitHashCurrent = await $`git rev-parse --short=8 HEAD`;
  const AWS_ECR_REPO = `${AWS_REPO_URL}/${AWS_REPO_NAME}`;

  const command = `docker build --push -f base.Dockerfile -t ${AWS_ECR_REPO}:${gitHashCurrent} --cache-from=${AWS_ECR_REPO}:cache-${gitHashMain} --cache-to=type=registry,ref=${AWS_ECR_REPO}:cache-${gitHashCurrent},mode=max,image-manifest=true .`;

  console.log(`b: ${command}`);

  await $`${command}`;
}

dockerBuildCache();
