import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestEnhancement} from '../mern/server/services/enhance.mjs';

const recipe={name:'Pasta',description:'Tomato pasta',servings:2,ingredients:[],steps:[]};
const options={goal:'Balanced',diet:'No preference',servings:2};
const env={OPENAI_API_KEY:'test-secret-never-return-this',OPENAI_MODEL:'gpt-4.1-mini'};

test('OpenAI failures produce actionable messages without leaking provider text',async t=>{
 const cases=[
  [401,'invalid_api_key',null,503,/API key/],
  [429,'insufficient_quota',null,503,/credits or spending limits/],
  [429,'some_new_billing_code','insufficient_quota',503,/credits or spending limits/],
  [429,'billing_hard_limit_reached',null,503,/credits or spending limits/],
  [404,'model_not_found',null,503,/model is unavailable/],
  [403,'permission_denied',null,503,/key permissions/],
  [429,'rate_limit_exceeded',null,429,/wait a minute/],
  [503,'server_error',null,502,/temporarily unavailable/],
  [400,'invalid_request',null,502,/request settings/],
 ];
 for(const [status,code,type,expectedStatus,pattern] of cases)await t.test(code+' '+(type||''),async()=>{
  await assert.rejects(()=>requestEnhancement(recipe,options,env,async()=>({ok:false,status,json:async()=>({error:{code,type,message:env.OPENAI_API_KEY}})})),error=>{
   assert.equal(error.status,expectedStatus);assert.match(error.message,pattern);assert.ok(!error.message.includes(env.OPENAI_API_KEY));return true;
  });
 });
});

test('non-JSON upstream errors retain a safe error message',async()=>{
 await assert.rejects(()=>requestEnhancement(recipe,options,env,async()=>({ok:false,status:502,json:async()=>{throw Error('not JSON');}})),/temporarily unavailable/);
});
