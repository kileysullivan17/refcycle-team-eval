import { z } from 'zod';
import { Condition, Stream } from './rules.ts';
export const AskRequest=z.object({jurisdiction:z.string().trim().min(1).max(100),query:z.string().trim().min(1).max(2000)}).strict();
export const AnswerSchema=z.object({jurisdiction:z.string(),item_interpreted:z.string().nullable(),behavior:z.enum(['answer','abstain','clarify','conditional']),stream:Stream.nullable(),conditions:z.array(Condition).min(1).nullable(),clarifying_question:z.string().min(1).nullable(),prep:z.array(z.string()),explanation:z.string().min(1),rule_ids:z.array(z.string()),source_urls:z.array(z.string().url()),model:z.string().min(1)}).strict().superRefine((a,c)=>{
 const bad=(message:string)=>c.addIssue({code:'custom',message});
 if((a.behavior==='answer')!==(a.stream!==null))bad('Only answers have a stream');
 if((a.behavior==='conditional')!==(a.conditions!==null))bad('Only conditional responses have conditions');
 if((a.behavior==='clarify')!==(a.clarifying_question!==null))bad('Only clarify has a question');
 if(['answer','conditional'].includes(a.behavior)&&!a.rule_ids.length)bad('Answer must cite rules');
});
export type Answer=z.infer<typeof AnswerSchema>;
export const SelectionSchema=z.object({behavior:z.enum(['answer','abstain','clarify','conditional']),item_interpreted:z.string().min(1).max(300).nullable(),selections:z.array(z.object({rule_id:z.string(),condition_index:z.number().int().nonnegative().nullable()}).strict()).max(8),clarifying_question:z.string().min(1).max(250).nullable()}).strict();
export type Selection=z.infer<typeof SelectionSchema>;
