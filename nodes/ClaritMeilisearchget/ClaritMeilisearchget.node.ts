import * as fs from 'fs';
import * as path from 'path';
import { Meilisearch } from "meilisearch";
import type {IExecuteFunctions,INodeExecutionData,INodeType,INodeTypeDescription, JsonObject, Icon} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError} from 'n8n-workflow';

const store_data_path_conf = path.join(__dirname, 'data.json');
const store_data_config = JSON.parse(fs.readFileSync(store_data_path_conf, 'utf8'));

// input — noduri care primesc date
// output — noduri care trimit date
// transform — noduri care transformă date
// trigger — noduri de declanșare

const nodeDescription = {
	displayName: 'ClarIT Meilisearch Search',
	name: 'claritMeilisearchget',
	group: ['output'],
	version: 1,
	description: 'Meilisearch Search Integrator',
		defaults: {
			name: 'ClarIT Meilisearch Get',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'meilisearchAuthApi',
				required: true,
				type: 'string'
			}
		],
		properties: [
			{
				displayName: 'Query',
				name: 'data_query',
				type: 'json',
				required:true,
				default: '',
			},
			{
				displayName: 'URL Meilisearch',
				name: 'url_meilisearch',
				type:  'string',
				default: '',
				placeholder: (store_data_config as JsonObject)?.url as string ?? 'http://meilisearch:7700',
				required:  (store_data_config as JsonObject)?.url as string === "http://meilisearch:7700" ? true : false, 
				description: 'URL intern meilisearch',
			},
			{
				displayName: 'Index',
				name: 'index_meilisearch',
				type:  'string',
				default: '',
				placeholder: (store_data_config as JsonObject)?.index as string ?? '{{index}}',
				required:  (store_data_config as JsonObject)?.index as string === "{{index}}" ? true : false, 
				description: 'Index-ul de unde preluăm datele',
			},
            {
				displayName: 'Limit',
				name: 'limit_meilisearch',
				type:  'number',
				default: 0,
                placeholder: (store_data_config as JsonObject)?.limit as number ?? 5,
				description: 'Limita la query',
			}
		]
};

// eslint-disable-next-line @n8n/community-nodes/icon-validation
export class ClaritMeilisearchget implements INodeType {
    //widget form
	description = {
		...nodeDescription,
		icon:{ light: 'file:../../icons/clarit_icon.svg', dark: 'file:../../icons/clarit_icon.svg' } as Icon,
	} as INodeTypeDescription;

    //execution function
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('meilisearchAuthApi');
		const cred_data = credentials?.api_key as string;

        let item: INodeExecutionData;
		let data_query: string;
		let url_meilisearch: string;
		let index_meilisearch: string;
        let limit_query: number;

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                data_query = this.getNodeParameter('data_query', itemIndex, '') as string;
				url_meilisearch = this.getNodeParameter('url_meilisearch', itemIndex, '') as string;
				index_meilisearch = this.getNodeParameter('index_meilisearch', itemIndex, '') as string;
                limit_query = this.getNodeParameter('limit_meilisearch', itemIndex, '') as number;
				item = items[itemIndex];

                let dist_url;
				let dist_index;
                let dist_limit;

                const stored_url = (store_data_config as JsonObject)?.url as string;
				const stored_index = (store_data_config as JsonObject)?.index as string;
                const stored_limit = (store_data_config as JsonObject)?.limit as number;

                if(stored_url !== url_meilisearch || stored_index !== index_meilisearch || stored_limit !== limit_query){
                    await fs.promises.writeFile(store_data_path_conf, JSON.stringify({"url":url_meilisearch !== "" ? url_meilisearch : stored_url,"index":index_meilisearch !== "" ? index_meilisearch : stored_index,"limit":limit_query !== stored_limit ? stored_limit : limit_query}));
                    dist_url = url_meilisearch !== "" ? url_meilisearch.trim() : stored_url.trim();
				    dist_index = index_meilisearch !== "" ? index_meilisearch.trim() : stored_index.trim();
                    dist_limit = limit_query !== stored_limit ? stored_limit : limit_query;
                }else{

                    dist_url = stored_url.trim();
				    dist_index = stored_index.trim();
                    dist_limit = stored_limit;
                }

                const client = new Meilisearch({
					host: dist_url,
					apiKey: cred_data,
				})

                const index = client.index(dist_index)

                await index.search(
                    data_query as string,
                    {
                        limit: dist_limit == 0 ? 5 : dist_limit as number,
                        offset: 0
                    }
                ).then((response) =>{
					item.json.response = response;
				}).catch((error: Error) =>{
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				})

            } catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
            }
        }

        return [items];
    }
}