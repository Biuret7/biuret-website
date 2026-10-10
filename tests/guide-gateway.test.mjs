import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,readReply} from '../guide/gateway.mjs';
test('embedded Guide sends each question through authenticated function executions',async()=>{
 const calls=[];let clients=0;
 const sdk={Client:class{constructor(){clients++;}setEndpoint(value){assert.equal(value,'https://fra.cloud.appwrite.io/v1');return this;}setProject(value){assert.equal(value,'6aa55a88003959a536e9');return this;}},Functions:class{async createExecution(value){calls.push(value);return {responseStatusCode:200,responseBody:JSON.stringify(value.body.includes('guide:status')?{configured:true}:{outcome:'answer',answer:'Fresh reply',sourceIds:['owner']})};}}};
 const gateway=createGateway({sdkProvider:async()=>sdk});assert.equal((await gateway.status()).configured,true);
 await gateway.ask({question:'Who owns the site?',site:'portfolio',locale:'en',consent:true,history:[]});
 await gateway.ask({question:'What does he focus on?',site:'portfolio',locale:'en',consent:true,history:[{question:'Who owns the site?',sourceIds:['owner']}]});
 assert.equal(clients,1);assert.equal(calls.length,3);
 assert.notEqual(calls[1].body,calls[2].body);assert.equal(JSON.parse(calls[2].body).history.length,1);
 for(const call of calls){assert.equal(call.functionId,'6aa5abef002dd368d5cc');assert.equal(call.async,false);assert.equal(call.method,'POST');assert.equal(JSON.parse(call.body).action.startsWith('guide:'),true);assert.equal(call.body.includes('API_KEY'),false);}
});
test('account restriction and provider errors are surfaced instead of saved replies',async()=>{
 const sdk={Client:class{setEndpoint(){return this;}setProject(){return this;}},Functions:class{async createExecution(){return {responseStatusCode:403,responseBody:'{"error":"private_pilot_only"}'};}}};
 await assert.rejects(createGateway({sdkProvider:async()=>sdk}).ask({question:'owner'}),e=>e.code===403&&e.message==='private_pilot_only');
 assert.equal(readReply({outcome:'unknown',sourceIds:[]},[{id:'owner'}]),null);
 assert.throws(()=>readReply({outcome:'answer',answer:'Saved-looking text',sourceIds:['invented']},[{id:'owner'}]));
 assert.throws(()=>readReply({outcome:'answer',answer:'https://evil.test',sourceIds:['owner']},[{id:'owner'}]));
 assert.equal(readReply({outcome:'clarify',answer:'Which page?',sourceIds:[]},[]).remote.outcome,'clarify');
});
