import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  MockIntegration,
  IResource,
  Integration,
  MethodOptions,
} from 'aws-cdk-lib/aws-apigateway';

interface AddAuthenticatedMethodOptions {
  resource: IResource;
  httpMethod: string;
  integration: Integration;
  authorizer: CognitoUserPoolsAuthorizer;
  methodOptions?: MethodOptions;
}

export function addAuthenticatedMethod(options: AddAuthenticatedMethodOptions): void {
  const { resource, httpMethod, integration, authorizer, methodOptions = {} } = options;
  resource.addMethod(httpMethod, integration, {
    ...methodOptions,
    authorizer,
    authorizationType: AuthorizationType.COGNITO,
  });
}

interface CorsMethodOptions {
  allowOrigin?: string;
  allowHeaders?: string;
  allowMethods?: string;
}

export function addCorsOptions(resource: IResource, options?: CorsMethodOptions): void {
  const allowOrigin = options?.allowOrigin ?? "'*'";
  const allowHeaders = options?.allowHeaders ?? "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'";
  const allowMethods = options?.allowMethods ?? "'GET,POST,PUT,DELETE,PATCH,OPTIONS'";

  resource.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': allowOrigin,
        'method.response.header.Access-Control-Allow-Headers': allowHeaders,
        'method.response.header.Access-Control-Allow-Methods': allowMethods,
      },
    }],
    requestTemplates: { 'application/json': '{"statusCode": 200}' },
  }), {
    authorizationType: AuthorizationType.NONE,
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
      },
    }],
  });
}
