import * as React from "react";
import { Blockhash, PublicKey, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import {
  Dispatch,
  PendingTransaction,
  TrackedCommitment,
  TransactionDetails,
  useDispatch,
} from "./index";
import {
  CreateTransactionRPC,
  CreateTransactionResponseMessage,
} from "../../workers/create-transaction-rpc";
import { useServerConfig } from "providers/server/http";
import { useBlockhash } from "providers/rpc/blockhash";
import { useSocket } from "providers/server/socket";
import { reportError } from "utils";
import { useConnection } from "providers/rpc";
import { subscribedCommitments } from "./confirmed";
import { useLatestTimestamp, useTargetSlotRef } from "providers/slot";
import { useAccountsState, AccountsConfig } from "providers/accounts";
import { useClientConfig } from "providers/config";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { useWalletState } from "providers/wallet";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
const idl = {
  "version": "0.1.0",
  "name": "orca_whirlpool_dca",
  "instructions": [
    {
      "name": "getTickArrays",
      "accounts": [
        {
          "name": "dcaThread",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [],
      "returns": {
        "defined": "clockwork_sdk::state::ThreadResponse"
      }
    }
  ]
}
export type ThreadProgram = {
  version: "1.3.15";
  name: "thread_program";
  docs: ["Program for creating transaction threads on Solana."];
  instructions: [
    {
      name: "getCrateInfo";
      docs: [
        "Return the crate information via `sol_set_return_data/sol_get_return_data`"
      ];
      accounts: [
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
      returns: {
        defined: "CrateInfo";
      };
    },
    {
      name: "threadExec";
      docs: ["Executes the next instruction on thread."];
      accounts: [
        {
          name: "fee";
          isMut: true;
          isSigner: false;
          docs: ["The worker's fee account."];
        },
        {
          name: "penalty";
          isMut: true;
          isSigner: false;
          docs: ["The worker's penalty account."];
        },
        {
          name: "pool";
          isMut: false;
          isSigner: false;
          docs: ["The active worker pool."];
        },
        {
          name: "signatory";
          isMut: true;
          isSigner: true;
          docs: ["The signatory."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to execute."];
        },
        {
          name: "worker";
          isMut: false;
          isSigner: false;
          docs: ["The worker."];
        }
      ];
      args: [];
    },
    {
      name: "threadCreate";
      docs: ["Creates a new transaction thread."];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: ["The payer for account initializations."];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
          docs: ["The Solana system program."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be created."];
        }
      ];
      args: [
        {
          name: "id";
          type: "string";
        },
        {
          name: "kickoffInstruction";
          type: {
            defined: "InstructionData";
          };
        },
        {
          name: "trigger";
          type: {
            defined: "Trigger";
          };
        }
      ];
    },
    {
      name: "threadDelete";
      docs: [
        "Closes an existing thread account and returns the lamports to the owner."
      ];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "closeTo";
          isMut: true;
          isSigner: false;
          docs: ["The address to return the data rent lamports to."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be delete."];
        }
      ];
      args: [];
    },
    {
      name: "threadKickoff";
      docs: ["Kicks off a thread if its trigger condition is active."];
      accounts: [
        {
          name: "signatory";
          isMut: true;
          isSigner: true;
          docs: ["The signatory."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to kickoff."];
        },
        {
          name: "worker";
          isMut: false;
          isSigner: false;
          docs: ["The worker."];
        }
      ];
      args: [];
    },
    {
      name: "threadPause";
      docs: ["Pauses an active thread."];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be paused."];
        }
      ];
      args: [];
    },
    {
      name: "threadResume";
      docs: ["Resumes a paused thread."];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be resumed."];
        }
      ];
      args: [];
    },
    {
      name: "threadStop";
      docs: ["Resumes a paused thread."];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be paused."];
        }
      ];
      args: [];
    },
    {
      name: "threadUpdate";
      docs: ["Allows an owner to update the mutable properties of a thread."];
      accounts: [
        {
          name: "authority";
          isMut: true;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
          docs: ["The Solana system program"];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be updated."];
        }
      ];
      args: [
        {
          name: "settings";
          type: {
            defined: "ThreadSettings";
          };
        }
      ];
    },
    {
      name: "threadWithdraw";
      docs: ["Allows an owner to withdraw from a thread's lamport balance."];
      accounts: [
        {
          name: "authority";
          isMut: false;
          isSigner: true;
          docs: ["The authority (owner) of the thread."];
        },
        {
          name: "payTo";
          isMut: true;
          isSigner: false;
          docs: ["The account to withdraw lamports to."];
        },
        {
          name: "thread";
          isMut: true;
          isSigner: false;
          docs: ["The thread to be."];
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "thread";
      docs: ["Tracks the current state of a transaction thread on Solana."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            docs: ["The owner of this thread."];
            type: "publicKey";
          },
          {
            name: "createdAt";
            docs: ["The cluster clock at the moment the thread was created."];
            type: {
              defined: "ClockData";
            };
          },
          {
            name: "execContext";
            docs: ["The context of the thread's current execution state."];
            type: {
              option: {
                defined: "ExecContext";
              };
            };
          },
          {
            name: "fee";
            docs: [
              "The number of lamports to payout to workers per execution."
            ];
            type: "u64";
          },
          {
            name: "id";
            docs: ["The id of the thread, given by the authority."];
            type: "string";
          },
          {
            name: "kickoffInstruction";
            docs: ["The instruction to kick-off the thread."];
            type: {
              defined: "InstructionData";
            };
          },
          {
            name: "nextInstruction";
            docs: ["The next instruction in the thread."];
            type: {
              option: {
                defined: "InstructionData";
              };
            };
          },
          {
            name: "paused";
            docs: ["Whether or not the thread is currently paused."];
            type: "bool";
          },
          {
            name: "rateLimit";
            docs: ["The maximum number of execs allowed per slot."];
            type: "u64";
          },
          {
            name: "trigger";
            docs: ["The triggering event to kickoff a thread."];
            type: {
              defined: "Trigger";
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "ThreadSettings";
      docs: ["The properties of threads which are updatable."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "fee";
            type: {
              option: "u64";
            };
          },
          {
            name: "kickoffInstruction";
            type: {
              option: {
                defined: "InstructionData";
              };
            };
          },
          {
            name: "rateLimit";
            type: {
              option: "u64";
            };
          },
          {
            name: "trigger";
            type: {
              option: {
                defined: "Trigger";
              };
            };
          }
        ];
      };
    },
    {
      name: "ExecContext";
      docs: ["The execution context of a particular transaction thread."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "execsSinceReimbursement";
            docs: ["Number of execs since the last tx reimbursement."];
            type: "u64";
          },
          {
            name: "execsSinceSlot";
            docs: ["Number of execs in this slot."];
            type: "u64";
          },
          {
            name: "lastExecAt";
            docs: ["Slot of the last exec"];
            type: "u64";
          },
          {
            name: "triggerContext";
            docs: ["Context for the triggering condition"];
            type: {
              defined: "TriggerContext";
            };
          }
        ];
      };
    },
    {
      name: "ClockData";
      docs: [
        "The clock object, representing a specific moment in time recorded by a Solana cluster."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "slot";
            docs: ["The current slot."];
            type: "u64";
          },
          {
            name: "epochStartTimestamp";
            docs: ["The timestamp of the first slot in this Solana epoch."];
            type: "i64";
          },
          {
            name: "epoch";
            docs: ["The bank epoch."];
            type: "u64";
          },
          {
            name: "leaderScheduleEpoch";
            docs: [
              "The future epoch for which the leader schedule has most recently been calculated."
            ];
            type: "u64";
          },
          {
            name: "unixTimestamp";
            docs: [
              "Originally computed from genesis creation time and network time",
              "in slots (drifty); corrected using validator timestamp oracle as of",
              "timestamp_correction and timestamp_bounding features."
            ];
            type: "i64";
          }
        ];
      };
    },
    {
      name: "ThreadResponse";
      docs: [
        "A response value target programs can return to update the thread."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "kickoffInstruction";
            docs: [
              "The kickoff instruction to use on the next triggering of the thread.",
              "If none, the kickoff instruction remains unchanged."
            ];
            type: {
              option: {
                defined: "InstructionData";
              };
            };
          },
          {
            name: "nextInstruction";
            docs: [
              "The next instruction to use on the next execution of the thread."
            ];
            type: {
              option: {
                defined: "InstructionData";
              };
            };
          }
        ];
      };
    },
    {
      name: "InstructionData";
      docs: ["The data needed execute an instruction on Solana."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "programId";
            docs: [
              "Pubkey of the instruction processor that executes this instruction"
            ];
            type: "publicKey";
          },
          {
            name: "accounts";
            docs: [
              "Metadata for what accounts should be passed to the instruction processor"
            ];
            type: {
              vec: {
                defined: "AccountMetaData";
              };
            };
          },
          {
            name: "data";
            docs: ["Opaque data passed to the instruction processor"];
            type: "bytes";
          }
        ];
      };
    },
    {
      name: "AccountMetaData";
      docs: ["Account metadata needed to execute an instruction on Solana."];
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            docs: ["An account's public key"];
            type: "publicKey";
          },
          {
            name: "isSigner";
            docs: [
              "True if an Instruction requires a Transaction signature matching `pubkey`."
            ];
            type: "bool";
          },
          {
            name: "isWritable";
            docs: [
              "True if the `pubkey` can be loaded as a read-write account."
            ];
            type: "bool";
          }
        ];
      };
    },
    {
      name: "Trigger";
      docs: ["The triggering conditions of a thread."];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Account";
            fields: [
              {
                name: "address";
                docs: ["The address of the account to monitor."];
                type: "publicKey";
              },
              {
                name: "offset";
                docs: ["The byte offset of the account data to monitor."];
                type: "u64";
              },
              {
                name: "size";
                docs: [
                  "The size of the byte slice to monitor (must be less than 1kb)"
                ];
                type: "u64";
              }
            ];
          },
          {
            name: "Cron";
            fields: [
              {
                name: "schedule";
                docs: [
                  "The schedule in cron syntax. Value must be parsable by the `clockwork_cron` package."
                ];
                type: "string";
              },
              {
                name: "skippable";
                docs: [
                  "Boolean value indicating whether triggering moments may be skipped if they are missed (e.g. due to network downtime).",
                  'If false, any "missed" triggering moments will simply be executed as soon as the network comes back online.'
                ];
                type: "bool";
              }
            ];
          },
          {
            name: "Immediate";
          }
        ];
      };
    },
    {
      name: "TriggerContext";
      docs: [
        "The event which allowed a particular transaction thread to be triggered."
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "Account";
            fields: [
              {
                name: "data_hash";
                docs: ["The account's data hash."];
                type: "u64";
              }
            ];
          },
          {
            name: "Cron";
            fields: [
              {
                name: "started_at";
                docs: ["The threshold moment the schedule was waiting for."];
                type: "i64";
              }
            ];
          },
          {
            name: "Immediate";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidThreadResponse";
      msg: "The exec response could not be parsed";
    },
    {
      code: 6001;
      name: "InvalidThreadState";
      msg: "The thread is in an invalid state";
    },
    {
      code: 6002;
      name: "TriggerNotActive";
      msg: "The trigger condition has not been activated";
    },
    {
      code: 6003;
      name: "ThreadBusy";
      msg: "This operation cannot be processes because the thread is currently busy";
    },
    {
      code: 6004;
      name: "ThreadPaused";
      msg: "The thread is currently paused";
    },
    {
      code: 6005;
      name: "RateLimitExeceeded";
      msg: "The thread's rate limit has been reached";
    },
    {
      code: 6006;
      name: "MaxRateLimitExceeded";
      msg: "Thread rate limits cannot exceed the maximum allowed value";
    },
    {
      code: 6007;
      name: "UnauthorizedWrite";
      msg: "Inner instruction attempted to write to an unauthorized address";
    },
    {
      code: 6008;
      name: "WithdrawalTooLarge";
      msg: "Withdrawing this amount would leave the thread with less than the minimum required SOL for rent exemption";
    }
  ];
};

export const IDL: ThreadProgram = {
  version: "1.3.15",
  name: "thread_program",
  docs: ["Program for creating transaction threads on Solana."],
  instructions: [
    {
      name: "getCrateInfo",
      docs: [
        "Return the crate information via `sol_set_return_data/sol_get_return_data`",
      ],
      accounts: [
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
      returns: {
        defined: "CrateInfo",
      },
    },
    {
      name: "threadExec",
      docs: ["Executes the next instruction on thread."],
      accounts: [
        {
          name: "fee",
          isMut: true,
          isSigner: false,
          docs: ["The worker's fee account."],
        },
        {
          name: "penalty",
          isMut: true,
          isSigner: false,
          docs: ["The worker's penalty account."],
        },
        {
          name: "pool",
          isMut: false,
          isSigner: false,
          docs: ["The active worker pool."],
        },
        {
          name: "signatory",
          isMut: true,
          isSigner: true,
          docs: ["The signatory."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to execute."],
        },
        {
          name: "worker",
          isMut: false,
          isSigner: false,
          docs: ["The worker."],
        },
      ],
      args: [],
    },
    {
      name: "threadCreate",
      docs: ["Creates a new transaction thread."],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: ["The payer for account initializations."],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          docs: ["The Solana system program."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be created."],
        },
      ],
      args: [
        {
          name: "id",
          type: "string",
        },
        {
          name: "kickoffInstruction",
          type: {
            defined: "InstructionData",
          },
        },
        {
          name: "trigger",
          type: {
            defined: "Trigger",
          },
        },
      ],
    },
    {
      name: "threadDelete",
      docs: [
        "Closes an existing thread account and returns the lamports to the owner.",
      ],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "closeTo",
          isMut: true,
          isSigner: false,
          docs: ["The address to return the data rent lamports to."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be delete."],
        },
      ],
      args: [],
    },
    {
      name: "threadKickoff",
      docs: ["Kicks off a thread if its trigger condition is active."],
      accounts: [
        {
          name: "signatory",
          isMut: true,
          isSigner: true,
          docs: ["The signatory."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to kickoff."],
        },
        {
          name: "worker",
          isMut: false,
          isSigner: false,
          docs: ["The worker."],
        },
      ],
      args: [],
    },
    {
      name: "threadPause",
      docs: ["Pauses an active thread."],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be paused."],
        },
      ],
      args: [],
    },
    {
      name: "threadResume",
      docs: ["Resumes a paused thread."],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be resumed."],
        },
      ],
      args: [],
    },
    {
      name: "threadStop",
      docs: ["Resumes a paused thread."],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be paused."],
        },
      ],
      args: [],
    },
    {
      name: "threadUpdate",
      docs: ["Allows an owner to update the mutable properties of a thread."],
      accounts: [
        {
          name: "authority",
          isMut: true,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
          docs: ["The Solana system program"],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be updated."],
        },
      ],
      args: [
        {
          name: "settings",
          type: {
            defined: "ThreadSettings",
          },
        },
      ],
    },
    {
      name: "threadWithdraw",
      docs: ["Allows an owner to withdraw from a thread's lamport balance."],
      accounts: [
        {
          name: "authority",
          isMut: false,
          isSigner: true,
          docs: ["The authority (owner) of the thread."],
        },
        {
          name: "payTo",
          isMut: true,
          isSigner: false,
          docs: ["The account to withdraw lamports to."],
        },
        {
          name: "thread",
          isMut: true,
          isSigner: false,
          docs: ["The thread to be."],
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "thread",
      docs: ["Tracks the current state of a transaction thread on Solana."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            docs: ["The owner of this thread."],
            type: "publicKey",
          },
          {
            name: "createdAt",
            docs: ["The cluster clock at the moment the thread was created."],
            type: {
              defined: "ClockData",
            },
          },
          {
            name: "execContext",
            docs: ["The context of the thread's current execution state."],
            type: {
              option: {
                defined: "ExecContext",
              },
            },
          },
          {
            name: "fee",
            docs: [
              "The number of lamports to payout to workers per execution.",
            ],
            type: "u64",
          },
          {
            name: "id",
            docs: ["The id of the thread, given by the authority."],
            type: "string",
          },
          {
            name: "kickoffInstruction",
            docs: ["The instruction to kick-off the thread."],
            type: {
              defined: "InstructionData",
            },
          },
          {
            name: "nextInstruction",
            docs: ["The next instruction in the thread."],
            type: {
              option: {
                defined: "InstructionData",
              },
            },
          },
          {
            name: "paused",
            docs: ["Whether or not the thread is currently paused."],
            type: "bool",
          },
          {
            name: "rateLimit",
            docs: ["The maximum number of execs allowed per slot."],
            type: "u64",
          },
          {
            name: "trigger",
            docs: ["The triggering event to kickoff a thread."],
            type: {
              defined: "Trigger",
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "ThreadSettings",
      docs: ["The properties of threads which are updatable."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "fee",
            type: {
              option: "u64",
            },
          },
          {
            name: "kickoffInstruction",
            type: {
              option: {
                defined: "InstructionData",
              },
            },
          },
          {
            name: "rateLimit",
            type: {
              option: "u64",
            },
          },
          {
            name: "trigger",
            type: {
              option: {
                defined: "Trigger",
              },
            },
          },
        ],
      },
    },
    {
      name: "ExecContext",
      docs: ["The execution context of a particular transaction thread."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "execsSinceReimbursement",
            docs: ["Number of execs since the last tx reimbursement."],
            type: "u64",
          },
          {
            name: "execsSinceSlot",
            docs: ["Number of execs in this slot."],
            type: "u64",
          },
          {
            name: "lastExecAt",
            docs: ["Slot of the last exec"],
            type: "u64",
          },
          {
            name: "triggerContext",
            docs: ["Context for the triggering condition"],
            type: {
              defined: "TriggerContext",
            },
          },
        ],
      },
    },
    {
      name: "ClockData",
      docs: [
        "The clock object, representing a specific moment in time recorded by a Solana cluster.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "slot",
            docs: ["The current slot."],
            type: "u64",
          },
          {
            name: "epochStartTimestamp",
            docs: ["The timestamp of the first slot in this Solana epoch."],
            type: "i64",
          },
          {
            name: "epoch",
            docs: ["The bank epoch."],
            type: "u64",
          },
          {
            name: "leaderScheduleEpoch",
            docs: [
              "The future epoch for which the leader schedule has most recently been calculated.",
            ],
            type: "u64",
          },
          {
            name: "unixTimestamp",
            docs: [
              "Originally computed from genesis creation time and network time",
              "in slots (drifty); corrected using validator timestamp oracle as of",
              "timestamp_correction and timestamp_bounding features.",
            ],
            type: "i64",
          },
        ],
      },
    },
    {
      name: "ThreadResponse",
      docs: [
        "A response value target programs can return to update the thread.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "kickoffInstruction",
            docs: [
              "The kickoff instruction to use on the next triggering of the thread.",
              "If none, the kickoff instruction remains unchanged.",
            ],
            type: {
              option: {
                defined: "InstructionData",
              },
            },
          },
          {
            name: "nextInstruction",
            docs: [
              "The next instruction to use on the next execution of the thread.",
            ],
            type: {
              option: {
                defined: "InstructionData",
              },
            },
          },
        ],
      },
    },
    {
      name: "InstructionData",
      docs: ["The data needed execute an instruction on Solana."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "programId",
            docs: [
              "Pubkey of the instruction processor that executes this instruction",
            ],
            type: "publicKey",
          },
          {
            name: "accounts",
            docs: [
              "Metadata for what accounts should be passed to the instruction processor",
            ],
            type: {
              vec: {
                defined: "AccountMetaData",
              },
            },
          },
          {
            name: "data",
            docs: ["Opaque data passed to the instruction processor"],
            type: "bytes",
          },
        ],
      },
    },
    {
      name: "AccountMetaData",
      docs: ["Account metadata needed to execute an instruction on Solana."],
      type: {
        kind: "struct",
        fields: [
          {
            name: "pubkey",
            docs: ["An account's public key"],
            type: "publicKey",
          },
          {
            name: "isSigner",
            docs: [
              "True if an Instruction requires a Transaction signature matching `pubkey`.",
            ],
            type: "bool",
          },
          {
            name: "isWritable",
            docs: [
              "True if the `pubkey` can be loaded as a read-write account.",
            ],
            type: "bool",
          },
        ],
      },
    },
    {
      name: "Trigger",
      docs: ["The triggering conditions of a thread."],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Account",
            fields: [
              {
                name: "address",
                docs: ["The address of the account to monitor."],
                type: "publicKey",
              },
              {
                name: "offset",
                docs: ["The byte offset of the account data to monitor."],
                type: "u64",
              },
              {
                name: "size",
                docs: [
                  "The size of the byte slice to monitor (must be less than 1kb)",
                ],
                type: "u64",
              },
            ],
          },
          {
            name: "Cron",
            fields: [
              {
                name: "schedule",
                docs: [
                  "The schedule in cron syntax. Value must be parsable by the `clockwork_cron` package.",
                ],
                type: "string",
              },
              {
                name: "skippable",
                docs: [
                  "Boolean value indicating whether triggering moments may be skipped if they are missed (e.g. due to network downtime).",
                  'If false, any "missed" triggering moments will simply be executed as soon as the network comes back online.',
                ],
                type: "bool",
              },
            ],
          },
          {
            name: "Immediate",
          },
        ],
      },
    },
    {
      name: "TriggerContext",
      docs: [
        "The event which allowed a particular transaction thread to be triggered.",
      ],
      type: {
        kind: "enum",
        variants: [
          {
            name: "Account",
            fields: [
              {
                name: "data_hash",
                docs: ["The account's data hash."],
                type: "u64",
              },
            ],
          },
          {
            name: "Cron",
            fields: [
              {
                name: "started_at",
                docs: ["The threshold moment the schedule was waiting for."],
                type: "i64",
              },
            ],
          },
          {
            name: "Immediate",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidThreadResponse",
      msg: "The exec response could not be parsed",
    },
    {
      code: 6001,
      name: "InvalidThreadState",
      msg: "The thread is in an invalid state",
    },
    {
      code: 6002,
      name: "TriggerNotActive",
      msg: "The trigger condition has not been activated",
    },
    {
      code: 6003,
      name: "ThreadBusy",
      msg: "This operation cannot be processes because the thread is currently busy",
    },
    {
      code: 6004,
      name: "ThreadPaused",
      msg: "The thread is currently paused",
    },
    {
      code: 6005,
      name: "RateLimitExeceeded",
      msg: "The thread's rate limit has been reached",
    },
    {
      code: 6006,
      name: "MaxRateLimitExceeded",
      msg: "Thread rate limits cannot exceed the maximum allowed value",
    },
    {
      code: 6007,
      name: "UnauthorizedWrite",
      msg: "Inner instruction attempted to write to an unauthorized address",
    },
    {
      code: 6008,
      name: "WithdrawalTooLarge",
      msg: "Withdrawing this amount would leave the thread with less than the minimum required SOL for rent exemption",
    },
  ],
};
const SEND_TIMEOUT_MS = 90000;
const RETRY_INTERVAL_MS = 500;

const workerRPC = new CreateTransactionRPC();
export const CreateTxContext = React.createContext<
  React.MutableRefObject<() => void | undefined> | undefined
>(undefined);

type ProviderProps = { children: React.ReactNode };
export function CreateTxProvider({ children }: ProviderProps) {
  const createTx = React.useRef(() => {});
  const [
    {
      trackedCommitment,
      showDebugTable,
      retryTransactionEnabled,
      computeUnitPrice,
      extraWriteAccount,
    },
  ] = useClientConfig();
  const serverConfig = useServerConfig();
  const accounts = useAccountsState().accounts;
  const idCounter = React.useRef<number>(0);
  const targetSlotRef = useTargetSlotRef();
  const programDataAccount = accounts?.programAccounts[0].toBase58();
  const latestTimestamp = useLatestTimestamp();

  // Reset counter when program data accounts are refreshed
  React.useEffect(() => {
    idCounter.current = 0;
  }, [programDataAccount]);

  const wallet = useWalletState().wallet;
  const connection = useConnection();
  const blockhash = useBlockhash();
  const dispatch = useDispatch();
  const socket = useSocket();
  React.useEffect(() => {
    createTx.current = () => {
      if (
        !connection ||
        !blockhash ||
        !socket ||
        !serverConfig ||
        !accounts ||
        !targetSlotRef.current
      ) {
        console.error("failed to send tx", {
          connection,
          blockhash,
          socket,
          serverConfig,
          accounts,
          targetSlot: targetSlotRef.current,
        });
        return;
      }

      const id = idCounter.current;
      if (id < accounts.accountCapacity * accounts.programAccounts.length) {
        idCounter.current++;

        const params: CreateTransactionParams = {
          blockhash,
          confirmationCommitment: trackedCommitment,
          targetSlot: targetSlotRef.current,
          programId: serverConfig.programId,
          accounts,
          trackingId: id,
          computeUnitPrice,
          extraWriteAccount,
        };

        createTransaction(
          wallet as Keypair,
          connection,
          params,
          showDebugTable,
          retryTransactionEnabled,
          dispatch,
          socket,
          latestTimestamp
        );
      } else {
        reportError(
          new Error("Account capacity exceeded"),
          "failed to create transaction"
        );
      }
    };
  }, [
    blockhash,
    connection,
    socket,
    serverConfig,
    accounts,
    dispatch,
    targetSlotRef,
    latestTimestamp,
    showDebugTable,
    trackedCommitment,
    retryTransactionEnabled,
    computeUnitPrice,
    extraWriteAccount,
  ]);

  return (
    <CreateTxContext.Provider value={createTx}>
      {children}
    </CreateTxContext.Provider>
  );
}

type CreateTransactionParams = {
  blockhash: Blockhash;
  confirmationCommitment: TrackedCommitment;
  targetSlot: number;
  programId: PublicKey;
  accounts: AccountsConfig;
  trackingId: number;
  computeUnitPrice?: number;
  extraWriteAccount?: string;
  threadName? : string
};

export function createTransaction(
  wallet: Keypair,
  connection: Connection,
  params: CreateTransactionParams,
  debugMode: boolean,
  retryEnabled: boolean,
  dispatch: Dispatch,
  socket: WebSocket,
  latestTimestamp: React.MutableRefObject<number | undefined>,
) {
  const {
    blockhash,
    confirmationCommitment,
    targetSlot,
    programId,
    accounts,
    
    trackingId,
    computeUnitPrice,
    extraWriteAccount,
    threadName,
  } = params;
  const { feePayerKeypairs, programAccounts } = accounts;

  const bitId = Math.floor(trackingId / feePayerKeypairs.length);
  const accountIndex = trackingId % feePayerKeypairs.length;
  const programDataAccount = programAccounts[accountIndex];
  const feePayerKeypair = feePayerKeypairs[accountIndex];
  const provider = new AnchorProvider(connection as Connection, new NodeWallet(wallet as Keypair), {})

  const program =  new Program(
    idl as Idl,
     new PublicKey("gmoKcrdX3TzaSDCYZc4AJkq817uFCFxXKHmrHKx8h1p"),
     provider,
   )
   
 const CLOCKWORK_THREAD_PROGRAM_ID = new PublicKey(
  '3XXuUFfweXBwFgFfYaejLvZE4cGZiHgKiGfMtdxNzYmv',
);
const threadProgram = new Program(
IDL as Idl,
CLOCKWORK_THREAD_PROGRAM_ID,

provider

)
  workerRPC
    .createTransaction({
      wallet,
      trackingId,
      blockhash,
      programId: programId.toBase58(),
      bitId,
      feeAccountSecretKey: feePayerKeypair.secretKey,
      computeUnitPrice,
      extraWriteAccount,
      program, threadProgram
    })
    .then(
      (response: CreateTransactionResponseMessage) => {
        const { signature, serializedTransaction } = response;

        console.log("send transaction using blockhash", blockhash);
        socket.send(serializedTransaction);

        const pendingTransaction: PendingTransaction = { targetSlot };
        pendingTransaction.timeoutId = window.setTimeout(() => {
          dispatch({ type: "timeout", trackingId });
        }, SEND_TIMEOUT_MS);

        const encodedSignature = bs58.encode(signature);
        const details: TransactionDetails = {
          id: bitId,
          feeAccount: feePayerKeypair.publicKey,
          programAccount: programDataAccount,
          signature: encodedSignature,
        };

        let subscribed: number | undefined;
        if (!debugMode) {
          subscribed = performance.now();
        }

        dispatch({
          type: "new",
          details,
          trackingId,
          pendingTransaction,
          subscribed,
        });

        if (debugMode) {
          const timestamp = latestTimestamp.current;
          if (timestamp) {
            dispatch({
              type: "subscribed",
              timestamp,
              trackingId,
            });
          }

          connection.onSignatureWithOptions(
            encodedSignature,
            (notification, context) => {
              const timestamp = latestTimestamp.current;
              if (timestamp && notification.type === "received") {
                dispatch({
                  type: "received",
                  timestamp,
                  trackingId,
                  slot: context.slot,
                });
              }
            },
            {
              commitment: "max",
              enableReceivedNotification: true,
            }
          );

          const commitments = subscribedCommitments(
            confirmationCommitment,
            debugMode
          );
          commitments.forEach((commitment) => {
            connection.onSignatureWithOptions(
              encodedSignature,
              (notification, context) => {
                const timestamp = latestTimestamp.current;
                if (timestamp && notification.type === "status") {
                  dispatch({
                    type: "track",
                    commitment,
                    trackingId,
                    slot: context.slot,
                    timestamp,
                  });
                }
              },
              { commitment }
            );
          });
        }

        if (retryEnabled) {
          pendingTransaction.retryId = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(serializedTransaction);
            }
          }, RETRY_INTERVAL_MS);
        }
      },
      (error: any) => {
        console.error(error);
      }
    );
}
