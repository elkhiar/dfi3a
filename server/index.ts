type AssetsBinding = {
  fetch(request: Request): Promise<Response>
}

type WorkerEnvironment = {
  ASSETS: AssetsBinding
}

export default {
  fetch(request: Request, environment: WorkerEnvironment) {
    return environment.ASSETS.fetch(request)
  },
}
