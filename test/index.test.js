const path = require('path');
const runServerless = require('@serverless/test/run-serverless');
const { baseConfig } = require('./utils');
const { expect } = require('chai');
const { describe, it } = require('mocha');

const serverlessDir = path.resolve('node_modules/serverless');

function getResources(cfTemplate, type) {
    const compiledResources = cfTemplate.Resources;
    return Object.entries(compiledResources).filter(([, resource]) => resource.Type === type);
}

describe('SAM Plugin Suite', () => {

    describe('Initialization', () => {

        it('SAM Plugin need the custom object config', async () => {
            try {
                await runServerless(serverlessDir, {
                    command: 'package',
                    config: baseConfig
                })
            } catch (error) {
                expect(error.message).equal('sam-plugin: ERROR: Missing custom configuration object')
            }
        });

        it('SAM Plugin need sam config in the custom object config', async () => {
            try {
                await runServerless(serverlessDir, {
                    command: 'package',
                    config: {
                        ...baseConfig,
                        custom: {},
                    }
                })
            } catch (error) {
                expect(error.message).equal('sam-plugin: ERROR: Missing custom.sam configuration object')
            }
        });

        it('SAM Plugin need activeAliasName in sam config in the custom object config', async () => {
            try {
                await runServerless(serverlessDir, {
                    command: 'package',
                    config: {
                        ...baseConfig,
                        custom: {
                            sam: {
                                activeAliasName: ''
                            }
                        },
                    }
                })
            } catch (error) {
                expect(error.message).equal('sam-plugin: ERROR: Missing custom.sam.activeAliasName property')
            }
        });
    })

    describe('Update Cloud Formation', () => {

        it('should not create a Lambda Alias when makeLambdasActive is false', async () => {
            const { cfTemplate } = await runServerless(serverlessDir, {
                command: 'package',
                config: {
                    ...baseConfig,
                    custom: {
                        sam: {
                            makeLambdasActive: false,
                        }
                    },
                }
            });

            const actualAliases = getResources(cfTemplate, 'AWS::Lambda::Alias');

            expect(actualAliases.length).equal(0);
        })

        it('should create a Lambda Alias when makeLambdasActive is true', async () => {
            const { cfTemplate } = await runServerless(serverlessDir, {
                command: 'package',
                config: {
                    ...baseConfig,
                    custom: {
                        sam: {
                            makeLambdasActive: true,
                        }
                    },
                }
            });

            const actualAliases = getResources(cfTemplate, 'AWS::Lambda::Alias');

            expect(actualAliases.length).equal(1);
        })

        it('should modify the API Gateway Integrations when useActiveAliasInEvents is true', async () => {
            const { cfTemplate } = await runServerless(serverlessDir, {
                command: 'package',
                config: {
                    ...baseConfig,
                    custom: {
                        sam: {
                            makeLambdasActive: true,
                            useActiveAliasInEvents: true
                        }
                    },
                }
            });

            const apiGatewayIntegrations = getResources(cfTemplate, 'AWS::ApiGatewayV2::Integration').filter(
                ([, resource]) => resource.Properties.IntegrationType === 'AWS_PROXY'
            );

            expect(apiGatewayIntegrations.length).equal(1);
            expect(apiGatewayIntegrations[0][1].Properties.IntegrationUri['Fn::GetAtt']).eql([
                'WebLambdaFunctionAlias',
                'AliasArn',
            ])
        })

        it('should modify the Event rules when useActiveAliasInEvents is true', async () => {
            const { cfTemplate } = await runServerless(serverlessDir, {
                command: 'package',
                config: {
                    ...baseConfig,
                    custom: {
                        sam: {
                            makeLambdasActive: true,
                            useActiveAliasInEvents: true
                        }
                    },
                }
            });

            const events = getResources(cfTemplate, 'AWS::Events::Rule');

            expect(events.length).equal(1);
            expect(events[0][1].Properties.Targets[0].Arn['Fn::GetAtt']).eql([
                'WebLambdaFunctionAlias',
                'AliasArn',
            ])
        })

        it('should modify the Event sources (SQS) when useActiveAliasInEvents is true', async () => {
            const { cfTemplate } = await runServerless(serverlessDir, {
                command: 'package',
                config: {
                    ...baseConfig,
                    custom: {
                        sam: {
                            makeLambdasActive: true,
                            useActiveAliasInEvents: true
                        }
                    },
                }
            });

            const events = getResources(cfTemplate, 'AWS::Lambda::EventSourceMapping');

            expect(events.length).equal(1);
            expect(events[0][1].Properties.FunctionName['Fn::GetAtt']).eql([
                'WebLambdaFunctionAlias',
                'AliasArn',
            ])
        })
    })
});