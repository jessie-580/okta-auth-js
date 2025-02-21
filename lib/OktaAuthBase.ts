/*!
 * Copyright (c) 2015-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */
import { assertValidConfig } from './builderUtil';
import { removeTrailingSlash } from './util';
import {
  transactionStatus,
  resumeTransaction,
  transactionExists,
  introspect,
  postToTransaction,
  AuthTransaction
} from './tx';
import PKCE from './oidc/util/pkce';
import {
  OktaAuth,
  OktaAuthOptions,
  SignInWithCredentialsOptions,
  ForgotPasswordOptions,
  VerifyRecoveryTokenOptions,
  TransactionAPI,
  SessionAPI,
  SigninAPI,
  PkceAPI,
} from './types';
import StorageManager from './StorageManager';
import TransactionManager from './TransactionManager';

export default class OktaAuthBase implements OktaAuth, SigninAPI {
  options: OktaAuthOptions;
  storageManager: StorageManager;
  transactionManager: TransactionManager;
  tx: TransactionAPI;
  userAgent: string;
  session: SessionAPI;
  pkce: PkceAPI;

  constructor(args: OktaAuthOptions) {
    assertValidConfig(args);
    this.options = {
      // OIDC configuration
      issuer: removeTrailingSlash(args.issuer),
      tokenUrl: removeTrailingSlash(args.tokenUrl),
      authorizeUrl: removeTrailingSlash(args.authorizeUrl),
      userinfoUrl: removeTrailingSlash(args.userinfoUrl),
      revokeUrl: removeTrailingSlash(args.revokeUrl),
      logoutUrl: removeTrailingSlash(args.logoutUrl),
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      state: args.state,
      scopes: args.scopes,
      postLogoutRedirectUri: args.postLogoutRedirectUri,
      responseMode: args.responseMode,
      responseType: args.responseType,
      pkce: args.pkce,

      // Internal options
      httpRequestClient: args.httpRequestClient,
      transformErrorXHR: args.transformErrorXHR,
      transformAuthState: args.transformAuthState,
      restoreOriginalUri: args.restoreOriginalUri,
      storageUtil: args.storageUtil,
      headers: args.headers,
      devMode: args.devMode || false,
      storageManager: Object.assign({
        token: {},
        transaction: {}
      }, args.storageManager),
      cookies: args.cookies,

      // Give the developer the ability to disable token signature validation.
      ignoreSignature: !!args.ignoreSignature
    };

    const { storageManager, cookies, storageUtil } = this.options;
    this.storageManager = new StorageManager(storageManager, cookies, storageUtil);
    this.transactionManager = new TransactionManager(Object.assign({
      storageManager: this.storageManager
    }, args.transactionManager));
  
    this.tx = {
      status: transactionStatus.bind(null, this),
      resume: resumeTransaction.bind(null, this),
      exists: Object.assign(transactionExists.bind(null, this), {
        _get: (name) => {
          const storage = storageUtil.storage;
          return storage.get(name);
        }
      }),
      introspect: introspect.bind(null, this)
    };

    this.pkce = {
      DEFAULT_CODE_CHALLENGE_METHOD: PKCE.DEFAULT_CODE_CHALLENGE_METHOD,
      generateVerifier: PKCE.generateVerifier,
      computeChallenge: PKCE.computeChallenge
    };
  }

  // { username, password, (relayState), (context) }
  signIn(opts: SignInWithCredentialsOptions): Promise<AuthTransaction> {
    return postToTransaction(this, '/api/v1/authn', opts);
  }

  getIssuerOrigin(): string {
    // Infer the URL from the issuer URL, omitting the /oauth2/{authServerId}
    return this.options.issuer.split('/oauth2/')[0];
  }

  // { username, (relayState) }
  forgotPassword(opts): Promise<AuthTransaction> {
    return postToTransaction(this, '/api/v1/authn/recovery/password', opts);
  }

  // { username, (relayState) }
  unlockAccount(opts: ForgotPasswordOptions): Promise<AuthTransaction> {
    return postToTransaction(this, '/api/v1/authn/recovery/unlock', opts);
  }

  // { recoveryToken }
  verifyRecoveryToken(opts: VerifyRecoveryTokenOptions): Promise<AuthTransaction> {
    return postToTransaction(this, '/api/v1/authn/recovery/token', opts);
  }

}
