import { Schema } from "effect"
import { ModelID, ProviderID } from "./ids.js"
import {
  mergeRequestOptions,
  type Capabilities,
  type Compatibility,
  type OpenString,
  type RequestOptions,
  type ProviderOptions,
} from "./options.js"
import type { Auth } from "../route/auth.js"
import { isRecord } from "../utils/record.js"
import type { AnyRoute, CompactionOperations } from "../route/client.js"
import type { DecisionModelRoute } from "../decision.js"
import type { ImageRoute } from "../image.js"
import type { SpeechRoute } from "../speech.js"
import type { TranscriptionRoute } from "../transcription.js"
import type { VideoRoute } from "../video.js"
import type { ExtractionRoute } from "../experimental/extraction.js"

/** The kind of model, named after models.dev model types. Each `ai.*` entry point takes one. */
export type ModelType = "chat" | "image" | "speech" | "transcription" | "video" | "extraction" | "decision"

/** Size limits, from models.dev v2 `limit` in camelCase. Carried for callers; requests don't read them yet. */
export interface Limit {
  readonly context?: number
  readonly input?: number
  readonly output?: number
  readonly requestBytes?: number
  readonly image?: {
    readonly maxPerMessage?: number
    readonly maxPerRequest?: number
    readonly maxBytes?: number
    readonly minWidth?: number
    readonly minHeight?: number
    readonly maxWidth?: number
    readonly maxHeight?: number
  }
  readonly pdf?: { readonly maxPerRequest?: number; readonly maxBytes?: number; readonly maxPages?: number }
}

/** A models.dev v2 modality: a broad kind or an exact MIME type. Outputs may also be `decision`, `embedding` or `reranking`. */
export type Modality = OpenString<
  "text" | "image" | "audio" | "video" | "application/pdf" | "decision" | "embedding" | "reranking"
>

/** Input and output modalities, from models.dev v2 `modalities`. Carried for callers; requests don't read them yet. */
export interface Modalities {
  readonly input: ReadonlyArray<Modality>
  readonly output: ReadonlyArray<Modality>
}

type Compact = CompactionOperations | undefined

/**
 * One model of any type, as a plain readonly object: who serves it, how it is reached, what it accepts, and the
 * options every request starts from. `type` selects the `ai.*` entry point that takes it and narrows the union.
 * Edit a model with a spread, such as `{ ...model, baseURL }`.
 */
export type Model<
  Type extends ModelType = ModelType,
  Options extends ProviderOptions = ProviderOptions,
  C extends Compact = Compact,
> = Type extends "chat" ? Model.Chat<Options, C> : Type extends ModelType ? Model.Fields<Type, Options, C> : never

export namespace Model {
  export interface Apis<C extends Compact> {
    readonly chat: AnyRoute<C>
    readonly image: ImageRoute
    readonly speech: SpeechRoute
    readonly transcription: TranscriptionRoute
    readonly video: VideoRoute
    readonly extraction: ExtractionRoute
    readonly decision: DecisionModelRoute
  }

  export interface Fields<Type extends ModelType, Options extends ProviderOptions, C extends Compact> {
    readonly id: ModelID
    readonly provider: ProviderID
    readonly type: Type
    /** How requests are built and sent. A text API may carry a default `baseURL` and `auth`, which the model's own override. */
    readonly api: Api<Type, C>
    /** Options every request starts from; the request's own win per key. */
    readonly options?: Omit<RequestOptions, "providerOptions"> & { readonly providerOptions?: Options }
    /** Empty when nothing is known: every field then keeps the protocol default. */
    readonly capabilities: Capabilities
    readonly limit?: Limit
    readonly modalities?: Modalities
    readonly compatibility?: Compatibility
  }

  export interface Chat<Options extends ProviderOptions = ProviderOptions, C extends Compact = Compact>
    extends Fields<"chat", Options, C> {
    /** Where requests go. */
    readonly baseURL?: string
    /** The request path when the host departs from the API's usual one, as models.dev v2 `path`. */
    readonly path?: string
    /** How requests authenticate. */
    readonly auth: Auth.Definition
  }

  export type Api<Type extends ModelType, C extends Compact = Compact> = Apis<C>[Type]

  /** `Model.make` input: a model whose ids may be plain strings and whose `capabilities` may be left out. */
  export interface Input<Type extends ModelType, C extends Compact = Compact> {
    readonly id: string | ModelID
    readonly provider: string | ProviderID
    readonly type: Type
    readonly api: Api<Type, C>
    /** Text models only; defaults to the API's. */
    readonly baseURL?: Type extends "chat" ? string : never
    /** Text models only. */
    readonly path?: Type extends "chat" ? string : never
    /** Text models only; defaults to the API's. */
    readonly auth?: Type extends "chat" ? Auth.Definition : never
    readonly options?: RequestOptions
    readonly capabilities?: Capabilities
    readonly limit?: Limit
    readonly modalities?: Modalities
    readonly compatibility?: Compatibility
  }

  /**
   * A model from its description. A text model gets its API's `baseURL` and `auth` unless it names its own, and its
   * options start from the API's.
   */
  export const make = <
    Type extends ModelType,
    Options extends ProviderOptions = ProviderOptions,
    C extends Compact = Compact,
  >(
    input: Input<Type, C>,
  ): Model<Type, Options, C> => {
    const model = {
      ...input,
      id: ModelID.make(input.id),
      provider: ProviderID.make(input.provider),
      capabilities: input.capabilities ?? {},
    }
    // The model's `providerOptions` type is a promise the API's request typing keeps; nothing here can check it.
    if (model.type !== "chat") return model as unknown as Model<Type, Options, C>
    const api = model.api as AnyRoute<C>
    const chat = model as Input<"chat", C>
    return {
      ...model,
      baseURL: chat.baseURL ?? api.endpoint.baseURL,
      auth: chat.auth ?? api.auth,
      options: mergeRequestOptions(api.options, model.options),
    } as unknown as Model<Type, Options, C>
  }
}

/** A Schema that accepts models of the given type, for request schemas. */
export const modelSchema = <Type extends ModelType>(type: Type) =>
  Schema.declare((value): value is Model<Type> => isRecord(value) && value.type === type && isRecord(value.api), {
    expected: `Model<"${type}">`,
  })

/** The `providerOptions` type a model's requests accept. */
export type ModelProviderOptions<SelectedModel> =
  SelectedModel extends Model<ModelType, infer Options> ? Options : never
